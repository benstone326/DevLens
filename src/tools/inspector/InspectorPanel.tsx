import { copyToClipboard } from '../../shared/clipboard'
import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Copy, Check, Box, Type, Palette, Code, ChevronRight } from 'lucide-react'
import { S } from '../../shared/theme'
import { postToParent } from '../../shared/messaging'
import { useHover } from '../../shared/hooks'
import type { InspectorElementData, BreadcrumbNode } from './index'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  data:     InspectorElementData | null
  isActive: boolean
}

type Tab = 'styles' | 'box' | 'fonts' | 'html'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Non-global regex — safe to reuse with .test() without lastIndex footgun.
// A global regex retains lastIndex between .test() calls in loops, causing
// alternating true/false results on repeated matches.
const COLOR_RE = /(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/

// Module-level timer — debounces style updates to avoid a postMessage storm
// on every keystroke. 50ms is imperceptible to the user but eliminates floods.
let _styleTimer: ReturnType<typeof setTimeout> | null = null
function sendStyleUpdate(prop: string, value: string) {
  if (_styleTimer) clearTimeout(_styleTimer)
  _styleTimer = setTimeout(() => {
    postToParent({ type: 'APPLY_STYLE', prop, value })
  }, 50)
}

// ─── CopyButton ───────────────────────────────────────────────────────────────
function CopyButton({ text, size = 10 }: { text: string; size?: number }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={e => { e.stopPropagation(); copyToClipboard(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded shrink-0"
      style={{ color: copied ? '#10b981' : S.sub }}
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  )
}

// ─── ValueWithSwatches ────────────────────────────────────────────────────────
function ValueWithSwatches({ value }: { value: string }) {
  const parts = value.split(COLOR_RE)
  return (
    <>
      {parts.map((part, i) => {
        if (COLOR_RE.test(part)) {
          return (
            <React.Fragment key={i}>
              <span title={part} style={{
                display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                background: part, flexShrink: 0,
                border: 'color-mix(in srgb, ButtonBorder 50%, Canvas) solid 1px',
                verticalAlign: 'middle', marginRight: 2, marginBottom: 1,
              }} />
              {part}
            </React.Fragment>
          )
        }
        return <React.Fragment key={i}>{part}</React.Fragment>
      })}
    </>
  )
}

// ─── VarsTable ────────────────────────────────────────────────────────────────
function VarsTable({ cssVars }: { cssVars: Record<string, string> }) {
  const entries = Object.entries(cssVars)
  if (!entries.length) return null
  return (
    <div className="mt-2 rounded-xl overflow-hidden"
         style={{ border: '1px solid #1e293b', background: '#0a0f1a' }}>
      <div className="px-3 py-1.5 text-[9px] font-medium tracking-widest uppercase"
           style={{ color: '#475569', borderBottom: '1px solid #1e293b' }}>
        Variables
      </div>
      {entries.map(([name, val]) => {
        const isColor = /^(#|rgb|hsl|oklch)/i.test(val.trim())
        return (
          <div key={name} className="flex items-start gap-2 px-3 py-1.5"
               style={{ borderBottom: '1px solid #0f172a' }}>
            <span className="text-[10px] font-mono shrink-0" style={{ color: '#c084fc' }}>{name}</span>
            <div className="flex flex-wrap items-center gap-1.5 ml-auto justify-end">
              {isColor && (
                <span style={{
                  display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
                  background: val, border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0,
                }} />
              )}
              <span className="text-[10px] font-mono text-right break-all" style={{ color: '#a5f3fc' }}>{val}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── StyleRow ────────────────────────────────────────────────────────────────
// Isolated component so each row has its own focus state — fixes the
// Rules-of-Hooks violation that previously existed when hooks were
// called inside a .map() callback.
function StyleRow({ prop, val, isChanged, canEdit, onChange, onReset, isLast }: {
  prop:     string
  val:      string
  isChanged: boolean
  canEdit:  boolean   // renamed from isLocked — 'isLocked' on the element means editing IS allowed
  onChange: (val: string) => void
  onReset:  () => void
  isLast:   boolean
}) {
  const [focused, setFocused] = useState(false)
  const isColor = /^(#|rgb|hsl|oklch)/i.test(val.trim())
  const isVar   = /^var\(/.test(val.trim())
  const valueColor = isChanged ? '#a5f3fc' : isVar ? '#c4b5fd' : '#fde68a'

  function scrollByMouse(e: React.MouseEvent<HTMLDivElement>) {
    const input = e.currentTarget.querySelector('input')
    if (!input) return
    const { left, width } = e.currentTarget.getBoundingClientRect()
    input.scrollLeft = ((e.clientX - left) / width) * (input.scrollWidth - input.clientWidth)
  }

  return (
    <div
      className="group flex items-center"
      style={{
        borderBottom: isLast ? 'none' : '1px solid #ffffff06',
        borderLeft:   isChanged ? '2px solid #6366f166' : '2px solid transparent',
        background:   isChanged ? '#6366f10c' : 'transparent',
      }}
    >
      {/* Property name */}
      <span className="text-[11px] font-mono pl-3 pr-1 shrink-0 select-none leading-5 whitespace-nowrap"
            style={{ color: '#64748b' }}>
        {prop}:
      </span>

      {/* Color swatch */}
      {isColor && (
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: val, border: '1px solid rgba(255,255,255,0.2)',
          flexShrink: 0, marginRight: 4,
        }} />
      )}

      {/* Value — outer div catches mousemove for cursor-position scroll */}
      <div className="relative flex-1 min-w-0 leading-5 overflow-hidden" onMouseMove={scrollByMouse}>
        {/* Colored overlay visible when not focused */}
        {!focused && (
          <div className="absolute inset-0 flex items-center text-[11px] font-mono pointer-events-none whitespace-nowrap overflow-hidden">
            <span style={{ color: valueColor }}>{val}</span>
          </div>
        )}
        <input
          type="text"
          value={val}
          readOnly={!canEdit}
          spellCheck={false}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="relative w-full bg-transparent outline-none text-[11px] font-mono leading-5 overflow-hidden p-0"
          style={{
            color:      focused ? valueColor : 'transparent',
            caretColor: '#818cf8',
            cursor:     canEdit ? 'text' : 'default',
          }}
        />
      </div>

      {/* Per-row reset — shown only when value has changed */}
      {isChanged ? (
        <button onClick={onReset} className="shrink-0 px-2 text-[9px]" style={{ color: '#f43f5e' }}>✕</button>
      ) : (
        <span className="shrink-0 w-6" />
      )}
    </div>
  )
}


// ─── CustomCSSBlock ───────────────────────────────────────────────────────────
// Lets the user type freeform CSS (property: value pairs, one per line)
// and applies them live to the locked element.
function CustomCSSBlock({ canEdit }: { canEdit: boolean }) {
  const [text, setText] = useState('')
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function applyCSS() {
    if (!canEdit) return
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const valid: [string, string][] = []
    const invalid: string[] = []
    for (const line of lines) {
      const colonIdx = line.indexOf(':')
      if (colonIdx < 1) { invalid.push(line); continue }
      const prop = line.slice(0, colonIdx).trim()
      const val  = line.slice(colonIdx + 1).replace(/;\s*$/, '').trim()
      if (!prop || !val) { invalid.push(line); continue }
      valid.push([prop, val])
    }
    if (invalid.length > 0) {
      setError(`Invalid lines: ${invalid.join(', ')}`)
      return
    }
    setError(null)
    for (const [prop, val] of valid) {
      window.parent.postMessage({ source: 'devlens-panel', type: 'APPLY_STYLE', prop, value: val }, '*')
    }
    setApplied(true)
    setTimeout(() => setApplied(false), 1500)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Ctrl/Cmd + Enter to apply
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      applyCSS()
    }
  }

  if (!canEdit) return null

  return (
    <div className="px-3 pb-3">
      <div className="rounded-xl overflow-hidden"
           style={{ border: `1px solid ${error ? '#f43f5e44' : applied ? '#10b98144' : '#1e293b'}`, background: '#0a0f1a' }}>
        <div className="flex items-center gap-2 px-3 py-1.5"
             style={{ borderBottom: '1px solid #1e293b' }}>
          <span className="text-[9px] font-semibold tracking-widest uppercase" style={{ color: '#475569' }}>
            Custom CSS
          </span>
          <span className="text-[9px] ml-auto" style={{ color: '#334155' }}>⌘↵ to apply</span>
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          readOnly={!canEdit}
          spellCheck={false}
          placeholder={"color: red;\nfont-size: 14px;"}
          rows={3}
          className="w-full bg-transparent outline-none text-[11px] font-mono leading-5 resize-none px-3 py-2"
          style={{ color: '#fde68a', caretColor: '#818cf8' }}
        />
        <div className="flex items-center gap-2 px-3 py-1.5" style={{ borderTop: '1px solid #1e293b' }}>
          {error && <span className="text-[9px] flex-1" style={{ color: '#f43f5e' }}>{error}</span>}
          <button
            onClick={applyCSS}
            className="ml-auto flex items-center gap-1 text-[10px] px-3 py-1 rounded-lg transition-colors"
            style={{
              background: applied ? '#10b98118' : '#6366f118',
              color:      applied ? '#10b981'   : '#818cf8',
              border:    `1px solid ${applied ? '#10b98144' : '#6366f133'}`,
            }}
          >
            {applied ? <Check size={9} /> : null}
            {applied ? 'Applied!' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── StylesBlock ──────────────────────────────────────────────────────────────
function StylesBlock({ styles, cssVars, canEdit }: {
  styles:  Record<string, string>
  cssVars: Record<string, string>
  canEdit: boolean
}) {
  const [values,  setValues]  = useState<Record<string, string>>(() => ({ ...styles }))
  const [changed, setChanged] = useState<Record<string, boolean>>({})
  const [copied,  setCopied]  = useState(false)

  // Reset local state whenever a new element is inspected
  useEffect(() => { setValues({ ...styles }); setChanged({}) }, [styles])

  function handleChange(prop: string, val: string) {
    if (!canEdit) return
    setValues(v => ({ ...v, [prop]: val }))
    setChanged(c => ({ ...c, [prop]: val !== styles[prop] }))
    sendStyleUpdate(prop, val)
  }

  function handleResetProp(prop: string) {
    const orig = styles[prop]
    setValues(v => ({ ...v, [prop]: orig }))
    setChanged(c => ({ ...c, [prop]: false }))
    sendStyleUpdate(prop, orig)
  }

  function handleResetAll() {
    setValues({ ...styles })
    setChanged({})
    for (const [p, v] of Object.entries(styles)) sendStyleUpdate(p, v)
  }

  function handleCopy() {
    copyToClipboard(Object.entries(values).map(([p, v]) => `  ${p}: ${v};`).join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const anyChanged = Object.values(changed).some(Boolean)
  const entries    = Object.entries(values)

  return (
    <div className="px-3 pb-3 flex flex-col flex-1">
      {/* Toolbar row */}
      <div className="flex items-center gap-2 pb-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors"
          style={{
            background: copied ? '#10b98118' : S.surface,
            color:      copied ? '#10b981'   : S.sub,
            border:    `1px solid ${copied ? '#10b98144' : S.border}`,
          }}
        >
          {copied ? <Check size={9} /> : <Copy size={9} />}
          {copied ? 'Copied!' : 'Copy all'}
        </button>

        {anyChanged && (
          <button
            onClick={handleResetAll}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg"
            style={{ background: '#f43f5e10', color: '#f43f5e', border: '1px solid #f43f5e33' }}
          >
            Reset all
          </button>
        )}

        <span className="text-[10px] ml-auto" style={{ color: anyChanged ? '#818cf8' : S.sub }}>
          {anyChanged ? '● live editing' : canEdit ? 'Click value to edit' : 'Lock element to edit'}
        </span>
      </div>

      {/* CSS rows */}
      <div className="rounded-xl overflow-hidden"
           style={{ background: '#0f172a', border: `1px solid ${anyChanged ? '#6366f155' : '#1e293b'}` }}>
        {entries.map(([prop, val], i) => (
          <StyleRow
            key={prop}
            prop={prop}
            val={val}
            isChanged={!!changed[prop]}
            canEdit={canEdit}
            onChange={v => handleChange(prop, v)}
            onReset={() => handleResetProp(prop)}
            isLast={i === entries.length - 1}
          />
        ))}
      </div>

      <VarsTable cssVars={cssVars} />
      <CustomCSSBlock canEdit={canEdit} />
    </div>
  )
}

// ─── HTML syntax highlighter ──────────────────────────────────────────────────
function highlightHtml(html: string): React.ReactNode[] {
  return html.split('\n').map((line, li) => {
    const nodes: React.ReactNode[] = []
    let lastIdx = 0
    const re = /(<\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)(\/?>)|(<!--[\s\S]*?-->)/g
    let m: RegExpExecArray | null

    while ((m = re.exec(line)) !== null) {
      if (m.index > lastIdx) {
        nodes.push(<span key={`t${m.index}`} style={{ color: '#94a3b8' }}>{line.slice(lastIdx, m.index)}</span>)
      }
      if (m[5]) {
        nodes.push(<span key={`cm${m.index}`} style={{ color: '#64748b', fontStyle: 'italic' }}>{m[5]}</span>)
      } else {
        nodes.push(<span key={`b${m.index}`}  style={{ color: '#64748b' }}>{m[1]}</span>)
        nodes.push(<span key={`tn${m.index}`} style={{ color: '#f472b6' }}>{m[2]}</span>)
        const attrs = m[3]
        if (attrs) {
          const attrNodes: React.ReactNode[] = []
          let ai = 0
          const attrRe = /\s+([\w:-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g
          let am: RegExpExecArray | null
          while ((am = attrRe.exec(attrs)) !== null) {
            if (am.index > ai) attrNodes.push(<span key={`ap${am.index}`} style={{ color: '#64748b' }}>{attrs.slice(ai, am.index)}</span>)
            attrNodes.push(<span key={`ak${am.index}`} style={{ color: '#7dd3fc' }}> {am[1]}</span>)
            const attrVal = am[2] ?? am[3] ?? am[4]
            if (attrVal !== undefined) {
              attrNodes.push(<span key={`aeq${am.index}`} style={{ color: '#64748b' }}>{'='}</span>)
              attrNodes.push(<span key={`av${am.index}`}  style={{ color: '#a5f3fc' }}>"{attrVal}"</span>)
            }
            ai = am.index + am[0].length
          }
          if (ai < attrs.length) attrNodes.push(<span key="atail" style={{ color: '#64748b' }}>{attrs.slice(ai)}</span>)
          nodes.push(...attrNodes)
        }
        nodes.push(<span key={`cb${m.index}`} style={{ color: '#64748b' }}>{m[4]}</span>)
      }
      lastIdx = m.index + m[0].length
    }
    if (lastIdx < line.length) {
      nodes.push(<span key="tail" style={{ color: '#94a3b8' }}>{line.slice(lastIdx)}</span>)
    }
    return <div key={li} className="min-h-5">{nodes.length ? nodes : '\u00a0'}</div>
  })
}

// ─── HTMLBlock ────────────────────────────────────────────────────────────────
function HTMLBlock({ html, canEdit }: { html: string; canEdit: boolean }) {
  const [code,   setCode]   = useState(html)
  const [edited, setEdited] = useState(false)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef      = useRef<HTMLPreElement>(null)

  // Sync incoming html when element changes (but not while user is editing)
  useEffect(() => {
    if (!edited) setCode(html)
  }, [html, edited])

  function syncScroll() {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop  = textareaRef.current.scrollTop
      preRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (!canEdit) return
    setCode(e.target.value)
    setEdited(true)
    postToParent({ type: 'APPLY_OUTERHTML', html: e.target.value })
  }

  function handleReset() {
    setCode(html)
    setEdited(false)
    postToParent({ type: 'APPLY_OUTERHTML', html })
  }

  function handleCopy() {
    copyToClipboard(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Memoized — only recomputes syntax highlighting when code changes, not on every render
  const highlighted = useMemo(() => highlightHtml(code), [code])

  // Both pre and textarea must have identical layout so selection highlight aligns.
  // Key rules:
  //  - Same font, size, padding, line-height — already handled by shared classes
  //  - Same overflow mode (overflow-auto on both, scroll synced)
  //  - NO break-all on pre — textarea wraps at word boundaries, pre must match exactly
  //  - Fixed min-height, grows with content
  const minLines   = Math.max(8, code.split('\n').length)
  const editorHeight = minLines * 20 + 24   // 20px per line (leading-5) + padding

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 pb-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors"
          style={{
            background: copied ? '#10b98118' : S.surface,
            color:      copied ? '#10b981'   : S.sub,
            border:    `1px solid ${copied ? '#10b98144' : S.border}`,
          }}
        >
          {copied ? <Check size={9} /> : <Copy size={9} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
        {edited && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors"
            style={{ background: '#f43f5e10', color: '#f43f5e', border: '1px solid #f43f5e33' }}
          >
            Reset
          </button>
        )}
        <span className="text-[10px] ml-auto" style={{ color: edited ? '#818cf8' : S.sub }}>
          {edited ? '● live editing' : canEdit ? 'Click to edit' : 'Lock element to edit'}
        </span>
      </div>

      <div className="relative rounded-xl overflow-hidden"
           style={{ height: editorHeight, background: '#0f172a', border: `1px solid ${edited ? '#6366f155' : '#1e293b'}` }}>
        <pre
          ref={preRef}
          aria-hidden
          className="absolute inset-0 px-3 py-2.5 text-[11px] font-mono pointer-events-none m-0 leading-5"
          style={{ overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'normal', overflowWrap: 'anywhere' }}
        >
          {highlighted}
        </pre>
        <textarea
          ref={textareaRef}
          value={code}
          onChange={handleChange}
          onScroll={syncScroll}
          readOnly={!canEdit}
          spellCheck={false}
          className="absolute inset-0 w-full h-full px-3 py-2.5 text-[11px] font-mono resize-none outline-none bg-transparent leading-5"
          style={{ color: 'transparent', caretColor: '#818cf8', cursor: canEdit ? 'text' : 'default',
                   zIndex: 1, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
        />
      </div>
    </div>
  )
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
function pillLabel(node: BreadcrumbNode) {
  if (node.id)             return `#${node.id}`
  if (node.classes.length) return `.${node.classes[0]}`
  return node.tag.toUpperCase()
}

// Isolated nav node — useHover per-button, not in a .map() callback
function BreadcrumbButton({ node, onClick }: { node: BreadcrumbNode; onClick: () => void }) {
  const [hovered, hoverProps] = useHover()
  return (
    <button
      onClick={onClick}
      title={`Go to <${node.tag}>`}
      className="text-[10px] font-mono whitespace-nowrap px-1 py-0.5 rounded shrink-0 transition-colors"
      style={{
        color:      hovered ? '#818cf8' : S.sub,
        background: hovered ? '#6366f115' : 'transparent',
      }}
      {...hoverProps}
    >
      {pillLabel(node)}
    </button>
  )
}

function BreadcrumbNav({ data, canEdit }: { data: InspectorElementData; canEdit: boolean }) {
  const total = data.ancestors.length

  function goToAncestor(realIndex: number) {
    // steps = how many levels up from current locked element
    postToParent({ type: 'NAVIGATE_TO', direction: 'ancestor', steps: total - realIndex })
  }

  const elementLabel = data.tagName.toUpperCase()
    + (data.id ? `#${data.id}` : '')
    + data.classes.slice(0, 2).map(c => `.${c}`).join('')

  return (
    <div className="px-3 pb-2 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl"
           style={{ background: S.surface, border: `1px solid ${canEdit ? '#f59e0b55' : S.border}` }}>
        <span className="text-[11px] font-mono font-bold flex-1 truncate" style={{ color: '#6366f1' }}>
          {elementLabel}
        </span>
        {canEdit && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md shrink-0"
                style={{ background: '#f59e0b18', color: '#f59e0b' }}>
            locked
          </span>
        )}
      </div>

      <div className="flex items-center overflow-x-auto px-1" style={{ scrollbarWidth: 'none' }}>
        {/* Show last 2 ancestors — use real index in full array, not slice index */}
        {data.ancestors.slice(-2).map((ancestor, i) => {
          const realIndex = total - 2 + i
          return (
            <React.Fragment key={`a-${realIndex}`}>
              {canEdit ? (
                <BreadcrumbButton node={ancestor} onClick={() => goToAncestor(realIndex)} />
              ) : (
                <span className="text-[10px] font-mono whitespace-nowrap px-1 shrink-0" style={{ color: S.sub }}>
                  {pillLabel(ancestor)}
                </span>
              )}
              <ChevronRight size={8} style={{ color: S.sub, flexShrink: 0, opacity: 0.4 }} />
            </React.Fragment>
          )
        })}

        {/* Current element chip */}
        <span className="text-[10px] font-mono font-bold whitespace-nowrap px-1.5 py-0.5 rounded shrink-0"
              style={{ background: '#6366f122', color: '#6366f1' }}>
          {data.tagName.toUpperCase()}
        </span>

        {/* Child navigation buttons — only visible when locked */}
        {canEdit && data.children.slice(0, 2).map((child, i) => (
          <React.Fragment key={`c-${i}`}>
            <ChevronRight size={8} style={{ color: S.sub, flexShrink: 0, opacity: 0.4 }} />
            <BreadcrumbButton
              node={child}
              onClick={() => postToParent({ type: 'NAVIGATE_TO', direction: 'child', childIndex: i })}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

// ─── InspectorPanel ───────────────────────────────────────────────────────────
export default function InspectorPanel({ data, isActive }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('styles')
  // canEdit = true when an element is locked (clicked) — naming clarifies intent
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === 'INSPECTOR_LOCKED')   setCanEdit(true)
      if (e.data?.type === 'INSPECTOR_UNLOCKED') setCanEdit(false)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  function switchTab(tab: Tab) {
    setActiveTab(tab)
    postToParent({ type: 'SET_BOX_MODE', enabled: tab === 'box' })
  }

  const tabs = [
    { id: 'styles' as Tab, icon: <Palette size={12} />, label: 'Styles' },
    { id: 'box'    as Tab, icon: <Box     size={12} />, label: 'Box'    },
    { id: 'fonts'  as Tab, icon: <Type    size={12} />, label: 'Fonts'  },
    { id: 'html'   as Tab, icon: <Code    size={12} />, label: 'HTML'   },
  ]

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 h-full gap-3 px-4 text-center">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#6366f122' }}>
          <Box size={18} style={{ color: '#6366f1' }} />
        </div>
        <p className="text-xs" style={{ color: S.sub }}>
          Hover over any element on the page to inspect it
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <BreadcrumbNav data={data} canEdit={canEdit} />

      {/* Tab bar */}
      <div className="grid px-3 gap-1 pb-2" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-all"
            style={{
              background: activeTab === tab.id ? '#6366f122' : S.surface,
              color:      activeTab === tab.id ? '#818cf8'   : S.sub,
              border:    `1px solid ${activeTab === tab.id ? '#6366f133' : S.border}`,
            }}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {activeTab === 'styles' && (
          <StylesBlock styles={data.computedStyles} cssVars={data.cssVars ?? {}} canEdit={canEdit} />
        )}

        {activeTab === 'box' && (
          <div className="p-3 flex flex-col gap-3">
            <div className="rounded-xl overflow-hidden text-[10px] font-mono"
                 style={{ border: `1px solid ${S.border}` }}>
              <div className="p-3" style={{ background: '#f59e0b0e' }}>
                <div className="text-center mb-1" style={{ color: '#f59e0b99' }}>margin</div>
                <div className="flex justify-center" style={{ color: '#f59e0b' }}>{data.boxModel.marginTop}px</div>
                <div className="p-2 rounded-lg mt-1" style={{ background: '#14b8a614' }}>
                  <div className="text-center mb-1" style={{ color: '#14b8a699' }}>padding</div>
                  <div className="flex justify-center" style={{ color: '#14b8a6' }}>{data.boxModel.paddingTop}px</div>
                  <div className="flex items-center gap-2 px-2 py-2 my-1 rounded" style={{ background: '#6366f118' }}>
                    <span style={{ color: '#6366f199' }}>{data.boxModel.paddingLeft}px</span>
                    <div className="flex-1 text-center" style={{ color: '#818cf8' }}>
                      <div className="font-bold">{Math.round(data.boxModel.width)} × {Math.round(data.boxModel.height)}</div>
                      <div className="text-[9px] mt-0.5" style={{ color: S.sub }}>content</div>
                    </div>
                    <span style={{ color: '#6366f199' }}>{data.boxModel.paddingRight}px</span>
                  </div>
                  <div className="flex justify-center" style={{ color: '#14b8a6' }}>{data.boxModel.paddingBottom}px</div>
                </div>
                <div className="flex justify-center mt-1" style={{ color: '#f59e0b' }}>{data.boxModel.marginBottom}px</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['Margin L/R',  `${data.boxModel.marginLeft}px / ${data.boxModel.marginRight}px`],
                ['Padding L/R', `${data.boxModel.paddingLeft}px / ${data.boxModel.paddingRight}px`],
                ['Border',      `${data.boxModel.borderTop}px`],
                ['Position',    `${Math.round(data.boxModel.left)}px, ${Math.round(data.boxModel.top)}px`],
              ] as [string, string][]).map(([label, val]) => (
                <div key={label} className="px-3 py-2 rounded-xl"
                     style={{ background: S.surface, border: `1px solid ${S.border}` }}>
                  <div className="text-[9px] mb-0.5" style={{ color: S.sub }}>{label}</div>
                  <div className="text-[11px] font-mono" style={{ color: '#6366f1' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'fonts' && (
          <FontsTab data={data} />
        )}

        {activeTab === 'html' && (
          <HTMLBlock html={data.outerHTML} canEdit={canEdit} />
        )}
      </div>
    </div>
  )
}

// ─── FontsTab ─────────────────────────────────────────────────────────────────
// Extracted to avoid inline onMouseEnter/Leave mutations in the parent map.
function FontRow({ label, val }: { label: string; val: string }) {
  const [hovered, hoverProps] = useHover()
  const [linkHovered, linkHoverProps] = useHover()
  const isFamily = label === 'Family'

  return (
    <div
      className="group py-0.5 px-2 rounded transition-colors"
      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', alignItems: 'center', gap: '4px', background: hovered ? S.surface : 'transparent' }}
      {...hoverProps}
    >
      <span className="text-[11px] font-mono" style={{ color: S.sub }}>{label}</span>
      <div className="min-w-0">
        {isFamily ? (
          <a
            href="#"
            onClick={e => {
              e.preventDefault()
              const name = val.replace(/['"]/g, '').split(',')[0].trim()
              postToParent({ type: 'OPEN_URL', url: `https://fonts.google.com/specimen/${name.replace(/ /g, '+')}` })
            }}
            className="text-[11px] font-mono break-all"
            style={{
              color: linkHovered ? '#818cf8' : '#6366f1',
              textDecoration: 'underline',
              textDecorationStyle: 'dotted',
              textDecorationColor: '#6366f166',
            }}
            {...linkHoverProps}
          >
            {val}
          </a>
        ) : (
          <span className="text-[11px] font-mono break-all" style={{ color: '#6366f1' }}>
            <ValueWithSwatches value={val} />
          </span>
        )}
      </div>
      <CopyButton text={val} />
    </div>
  )
}

function FontsTab({ data }: { data: InspectorElementData }) {
  const rows: [string, string][] = [
    ['Family',      data.fonts.family],
    ['Size',        data.fonts.size],
    ['Weight',      data.fonts.weight],
    ['Line Height', data.fonts.lineHeight],
    ['Color',       data.fonts.color],
  ]
  return (
    <div className="pb-3">
      {rows.map(([label, val]) => (
        <FontRow key={label} label={label} val={val} />
      ))}
      <div className="mx-2 mt-2 px-3 py-3 rounded-xl"
           style={{ background: S.surface, border: `1px solid ${S.border}` }}>
        <div className="text-[9px] mb-2" style={{ color: S.sub }}>PREVIEW</div>
        <div style={{
          fontFamily:  data.fonts.family,
          fontSize:    '15px',
          fontWeight:  data.fonts.weight,
          color:       S.text,
          lineHeight:  data.fonts.lineHeight,
        }}>
          The quick brown fox
        </div>
      </div>
    </div>
  )
}
