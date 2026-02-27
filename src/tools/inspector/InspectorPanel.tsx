import { copyToClipboard } from '../../shared/clipboard'
import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Copy, Check, Box, Type, Palette, Code, ChevronRight, Search, X, Lock, Unlock } from 'lucide-react'
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

// CSS property groups — Design idea B: group properties by category
const CSS_GROUPS: { label: string; props: RegExp }[] = [
  { label: 'Layout',     props: /^(display|flex|grid|align|justify|order|gap|place|float|clear|overflow|position|top|right|bottom|left|z-index|visibility)/ },
  { label: 'Spacing',    props: /^(margin|padding|width|height|min-|max-)/ },
  { label: 'Typography', props: /^(font|line-height|letter-spacing|text|white-space|word|color$)/ },
  { label: 'Visual',     props: /^(background|border|outline|box-shadow|opacity|transform|transition|animation|filter|backdrop|cursor|pointer|content|list)/ },
]

function groupStyles(entries: [string, string][]): { label: string; entries: [string, string][] }[] {
  const buckets: Record<string, [string, string][]> = {}
  const other: [string, string][] = []
  CSS_GROUPS.forEach(g => { buckets[g.label] = [] })

  for (const entry of entries) {
    const group = CSS_GROUPS.find(g => g.props.test(entry[0]))
    if (group) buckets[group.label].push(entry)
    else other.push(entry)
  }

  const result = CSS_GROUPS
    .filter(g => buckets[g.label].length > 0)
    .map(g => ({ label: g.label, entries: buckets[g.label] }))

  if (other.length > 0) result.push({ label: 'Other', entries: other })
  return result
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const COLOR_RE = /(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/

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
function StyleRow({ prop, val, isChanged, canEdit, onChange, onReset, isLast }: {
  prop:      string
  val:       string
  isChanged: boolean
  canEdit:   boolean
  onChange:  (val: string) => void
  onReset:   () => void
  isLast:    boolean
}) {
  const [focused, setFocused] = useState(false)
  const isColor    = /^(#|rgb|hsl|oklch)/i.test(val.trim())
  const isVar      = /^var\(/.test(val.trim())
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
      <span className="text-[11px] font-mono pl-3 pr-1 shrink-0 select-none leading-5 whitespace-nowrap"
            style={{ color: '#64748b' }}>
        {prop}:
      </span>

      {isColor && (
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: val, border: '1px solid rgba(255,255,255,0.2)',
          flexShrink: 0, marginRight: 4,
        }} />
      )}

      <div className="relative flex-1 min-w-0 leading-5 overflow-hidden" onMouseMove={scrollByMouse}>
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

      {/* Design idea D: Copy button per row (appears on hover, in reset slot when unchanged) */}
      {isChanged ? (
        <button onClick={onReset} className="shrink-0 px-2 text-[9px]" style={{ color: '#f43f5e' }}>✕</button>
      ) : (
        <CopyButton text={`${prop}: ${val}`} size={9} />
      )}
    </div>
  )
}

// ─── StyleGroup ───────────────────────────────────────────────────────────────
function StyleGroup({ label, entries, changed, canEdit, onChange, onReset }: {
  label:    string
  entries:  [string, string][]
  changed:  Record<string, boolean>
  canEdit:  boolean
  onChange: (prop: string, val: string) => void
  onReset:  (prop: string) => void
}) {
  const [open, setOpen] = useState(true)
  const changedCount = entries.filter(([p]) => changed[p]).length

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-3 py-1 text-[9px] font-semibold tracking-widest uppercase transition-colors"
        style={{ color: '#475569', background: 'transparent', border: 'none' }}
      >
        <span style={{
          display: 'inline-block', width: 6, height: 6,
          borderTop: '1px solid #475569', borderRight: '1px solid #475569',
          transform: open ? 'rotate(-45deg) translateY(1px)' : 'rotate(135deg) translateY(-1px)',
          transition: 'transform 0.15s', flexShrink: 0,
        }} />
        {label}
        <span className="ml-auto font-mono font-normal" style={{ color: '#334155' }}>{entries.length}</span>
        {changedCount > 0 && (
          <span className="px-1 rounded text-[8px]" style={{ background: '#6366f122', color: '#818cf8' }}>
            {changedCount} live
          </span>
        )}
      </button>

      {open && (
        <div className="rounded-xl overflow-hidden mx-0"
             style={{ background: '#0f172a', border: `1px solid ${changedCount > 0 ? '#6366f155' : '#1e293b'}` }}>
          {entries.map(([prop, val], i) => (
            <StyleRow
              key={prop}
              prop={prop}
              val={val}
              isChanged={!!changed[prop]}
              canEdit={canEdit}
              onChange={v => onChange(prop, v)}
              onReset={() => onReset(prop)}
              isLast={i === entries.length - 1}
            />
          ))}
        </div>
      )}
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
  // Design idea A: search/filter
  const [query, setQuery] = useState('')

  useEffect(() => { setValues({ ...styles }); setChanged({}); setQuery('') }, [styles])

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

  // Filter entries by search query
  const allEntries = Object.entries(values)
  const filtered = query.trim()
    ? allEntries.filter(([prop, val]) =>
        prop.includes(query.toLowerCase()) || val.toLowerCase().includes(query.toLowerCase())
      )
    : allEntries

  // Design idea B: group by category (only when not filtering)
  const groups = useMemo(() => groupStyles(filtered), [filtered])

  return (
    <div className="px-3 pb-3 flex flex-col flex-1">
      {/* Toolbar */}
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

      {/* Design idea A: search bar */}
      <div className="relative mb-2">
        <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: '#475569' }} />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="filter properties…"
          className="w-full text-[10px] font-mono rounded-lg pl-7 pr-7 py-1.5 outline-none"
          style={{
            background: '#0f172a', color: '#94a3b8',
            border: `1px solid ${query ? '#6366f133' : '#1e293b'}`,
            caretColor: '#818cf8',
          }}
        />
        {query && (
          <button onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2"
            style={{ color: '#475569' }}>
            <X size={10} />
          </button>
        )}
      </div>

      {/* Design idea B: grouped CSS properties */}
      {filtered.length === 0 ? (
        <div className="text-[10px] text-center py-4" style={{ color: '#475569' }}>
          No properties match "{query}"
        </div>
      ) : (
        <div className="flex flex-col">
          {groups.map(group => (
            <StyleGroup
              key={group.label}
              label={group.label}
              entries={group.entries}
              changed={changed}
              canEdit={canEdit}
              onChange={handleChange}
              onReset={handleResetProp}
            />
          ))}
        </div>
      )}

      <VarsTable cssVars={cssVars} />
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

  const editorHeight = Math.max(160, code.split('\n').length * 20 + 24)
  const highlighted  = useMemo(() => highlightHtml(code), [code])

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
          className="absolute inset-0 px-3 py-2.5 text-[11px] font-mono pointer-events-none overflow-hidden m-0 whitespace-pre-wrap break-all leading-5"
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
          style={{ color: 'transparent', caretColor: '#818cf8', cursor: canEdit ? 'text' : 'default', zIndex: 1 }}
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

function BreadcrumbNav({ data, canEdit, onToggleLock }: {
  data:           InspectorElementData
  canEdit:        boolean
  onToggleLock:   () => void   // Design idea C: chip click toggles lock
}) {
  const [chipHovered, chipHoverProps] = useHover()
  const total = data.ancestors.length

  function goToAncestor(realIndex: number) {
    postToParent({ type: 'NAVIGATE_TO', direction: 'ancestor', steps: total - realIndex })
  }

  const elementLabel = data.tagName.toUpperCase()
    + (data.id ? `#${data.id}` : '')
    + data.classes.slice(0, 2).map(c => `.${c}`).join('')

  return (
    <div className="px-3 pb-2 flex flex-col gap-1">
      {/* Design idea C: current element chip is a lock toggle */}
      <button
        onClick={onToggleLock}
        title={canEdit ? 'Click to unlock element' : 'Click to lock element for editing'}
        {...chipHoverProps}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl w-full text-left transition-colors"
        style={{
          background: S.surface,
          border: `1px solid ${canEdit ? '#f59e0b55' : chipHovered ? '#6366f133' : S.border}`,
        }}
      >
        <span className="text-[11px] font-mono font-bold flex-1 truncate" style={{ color: '#6366f1' }}>
          {elementLabel}
        </span>
        {canEdit ? (
          <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md shrink-0"
                style={{ background: '#f59e0b18', color: '#f59e0b' }}>
            <Lock size={8} /> locked
          </span>
        ) : chipHovered ? (
          <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md shrink-0"
                style={{ background: '#6366f115', color: '#818cf8' }}>
            <Lock size={8} /> click to lock
          </span>
        ) : null}
      </button>

      <div className="flex items-center overflow-x-auto px-1" style={{ scrollbarWidth: 'none' }}>
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

        <span className="text-[10px] font-mono font-bold whitespace-nowrap px-1.5 py-0.5 rounded shrink-0"
              style={{ background: '#6366f122', color: '#6366f1' }}>
          {data.tagName.toUpperCase()}
        </span>

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

// ─── BoxTab — Design idea E: flat grid layout ─────────────────────────────────
function BoxTab({ data }: { data: InspectorElementData }) {
  const bm = data.boxModel
  const fmt = (n: number) => `${Math.round(n)}px`

  // Flat rows: label, all 4 sides, colour accent
  const rows: { label: string; t: number; r: number; b: number; l: number; color: string; bg: string }[] = [
    { label: 'Margin',  t: bm.marginTop,  r: bm.marginRight,  b: bm.marginBottom,  l: bm.marginLeft,  color: '#f59e0b', bg: '#f59e0b0e' },
    { label: 'Border',  t: bm.borderTop,  r: bm.borderRight,  b: bm.borderBottom,  l: bm.borderLeft,  color: '#14b8a6', bg: '#14b8a614' },
    { label: 'Padding', t: bm.paddingTop, r: bm.paddingRight, b: bm.paddingBottom, l: bm.paddingLeft, color: '#10b981', bg: '#10b98114' },
  ]

  return (
    <div className="p-3 flex flex-col gap-2">
      {/* Content size — prominent */}
      <div className="rounded-xl px-4 py-3 flex items-center justify-between"
           style={{ background: '#6366f118', border: '1px solid #6366f133' }}>
        <span className="text-[10px]" style={{ color: S.sub }}>content</span>
        <span className="text-sm font-mono font-bold" style={{ color: '#818cf8' }}>
          {Math.round(bm.width)} × {Math.round(bm.height)}
        </span>
        <span className="text-[10px]" style={{ color: S.sub }}>
          {fmt(bm.left)}, {fmt(bm.top)}
        </span>
      </div>

      {/* Flat rows — margin / border / padding */}
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
        {/* Column headers */}
        <div className="grid text-[9px] px-3 py-1.5"
             style={{ gridTemplateColumns: '64px 1fr 1fr 1fr 1fr', color: '#334155',
                      borderBottom: `1px solid ${S.border}`, background: S.surface }}>
          <span />
          <span className="text-center">top</span>
          <span className="text-center">right</span>
          <span className="text-center">bottom</span>
          <span className="text-center">left</span>
        </div>
        {rows.map(row => (
          <div key={row.label}
               className="grid items-center px-3 py-1.5 text-[11px] font-mono"
               style={{ gridTemplateColumns: '64px 1fr 1fr 1fr 1fr',
                        background: row.bg, borderBottom: `1px solid ${S.border}` }}>
            <span className="text-[9px] font-sans font-semibold tracking-wide" style={{ color: row.color }}>
              {row.label.toUpperCase()}
            </span>
            {[row.t, row.r, row.b, row.l].map((v, i) => (
              <span key={i} className="text-center" style={{ color: v === 0 ? '#334155' : row.color }}>
                {fmt(v)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── FontsTab ─────────────────────────────────────────────────────────────────
function FontRow({ label, val }: { label: string; val: string }) {
  const [hovered, hoverProps] = useHover()
  return (
    <div
      className="group py-0.5 px-2 rounded transition-colors"
      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', alignItems: 'center', gap: '4px',
               background: hovered ? S.surface : 'transparent' }}
      {...hoverProps}
    >
      <span className="text-[11px] font-mono" style={{ color: S.sub }}>{label}</span>
      <div className="min-w-0">
        {label === 'Family' ? (
          <a
            href="#"
            onClick={e => {
              e.preventDefault()
              const name = val.replace(/['"]/g, '').split(',')[0].trim()
              postToParent({ type: 'OPEN_URL', url: `https://fonts.google.com/specimen/${name.replace(/ /g, '+')}` })
            }}
            className="text-[11px] font-mono break-all transition-colors"
            style={{ color: '#6366f1', textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: '#6366f166' }}
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
      <div className="mx-2 mt-2 px-3 py-3 rounded-xl" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
        <div className="text-[9px] mb-2" style={{ color: S.sub }}>PREVIEW</div>
        <div style={{ fontFamily: data.fonts.family, fontSize: '15px', fontWeight: data.fonts.weight,
                      color: S.text, lineHeight: data.fonts.lineHeight }}>
          The quick brown fox
        </div>
      </div>
    </div>
  )
}

// ─── InspectorPanel ───────────────────────────────────────────────────────────
export default function InspectorPanel({ data, isActive }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('styles')
  const [canEdit,   setCanEdit]   = useState(false)

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === 'INSPECTOR_LOCKED')   setCanEdit(true)
      if (e.data?.type === 'INSPECTOR_UNLOCKED') setCanEdit(false)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // Design idea C: breadcrumb chip toggles lock without requiring a page click
  function handleToggleLock() {
    if (canEdit) {
      postToParent({ type: 'UNLOCK_ELEMENT' })
      setCanEdit(false)
    } else {
      postToParent({ type: 'LOCK_ELEMENT' })
      setCanEdit(true)
    }
  }

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
      <BreadcrumbNav data={data} canEdit={canEdit} onToggleLock={handleToggleLock} />

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

      <div className="flex-1 overflow-y-auto flex flex-col">
        {activeTab === 'styles' && (
          <StylesBlock styles={data.computedStyles} cssVars={data.cssVars ?? {}} canEdit={canEdit} />
        )}
        {activeTab === 'box'    && <BoxTab   data={data} />}
        {activeTab === 'fonts'  && <FontsTab data={data} />}
        {activeTab === 'html'   && <HTMLBlock html={data.outerHTML} canEdit={canEdit} />}
      </div>
    </div>
  )
}
