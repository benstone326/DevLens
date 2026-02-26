import { copyToClipboard } from '../../shared/clipboard'
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Copy, Check, Box, Type, Palette, Code, ChevronRight } from 'lucide-react'
import { S } from '../../shared/theme'
import type { InspectorElementData, BreadcrumbNode } from './index'

interface Props {
  data: InspectorElementData | null
  isActive: boolean
}

type Tab = 'styles' | 'box' | 'fonts' | 'html'

function CopyButton({ text, size = 10 }: { text: string; size?: number }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={e => { e.stopPropagation(); copyToClipboard(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded shrink-0"
      style={{ color: copied ? '#10b981' : S.sub }}>
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  )
}

// Debounced to avoid message storm when typing fast
let _styleTimer: ReturnType<typeof setTimeout> | null = null
function sendStyleUpdate(prop: string, value: string) {
  if (_styleTimer) clearTimeout(_styleTimer)
  _styleTimer = setTimeout(() => {
    window.parent.postMessage({ source: 'devlens-panel', type: 'APPLY_STYLE', prop, value }, '*')
  }, 50)
}

// Non-global — safe to reuse with .test() without lastIndex footgun
const COLOR_RE = /(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/

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


// ─── Shared: variables table ──────────────────────────────────────────────────
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
              {isColor && <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: val, border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />}
              <span className="text-[10px] font-mono text-right break-all" style={{ color: '#a5f3fc' }}>{val}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Single editable row ──────────────────────────────────────────────────────
function StyleRow({ prop, val, isChanged, isLocked, onchange, onReset, isLast }: {
  prop: string
  val: string
  isChanged: boolean
  isLocked: boolean
  onchange: (val: string) => void
  onReset: () => void
  isLast: boolean
}) {
  const [focused, setFocused] = useState(false)
  const isColor = /^(#|rgb|hsl|oklch)/i.test(val.trim())
  const isVar = /^var\(/.test(val.trim())
  const valueColor = isChanged ? '#a5f3fc' : isVar ? '#c4b5fd' : '#fde68a'

  function scrollByMouse(e: React.MouseEvent<HTMLElement>) {
    const input = (e.currentTarget as HTMLElement).querySelector('input') ?? (e.currentTarget as HTMLInputElement)
    const { left, width } = e.currentTarget.getBoundingClientRect()
    input.scrollLeft = (e.clientX - left) / width * (input.scrollWidth - input.clientWidth)
  }

  return (
    <div className="group flex items-center"
         style={{
           borderBottom: !isLast ? '1px solid #ffffff06' : 'none',
           borderLeft: isChanged ? '2px solid #6366f166' : '2px solid transparent',
           background: isChanged ? '#6366f10c' : 'transparent',
         }}>
      {/* Property */}
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
      {/* Value — outer div catches mousemove for scroll */}
      <div className="relative flex-1 min-w-0 leading-5 overflow-hidden"
           onMouseMove={scrollByMouse}>
        {!focused && (
          <div className="absolute inset-0 flex items-center text-[11px] font-mono pointer-events-none whitespace-nowrap overflow-hidden">
            <span style={{ color: valueColor }}>{val}</span>
          </div>
        )}
        <input
          type="text"
          value={val}
          readOnly={!isLocked}
          spellCheck={false}
          onChange={e => onchange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="relative w-full bg-transparent outline-none text-[11px] font-mono leading-5 overflow-hidden p-0"
          style={{
            color: focused ? valueColor : 'transparent',
            caretColor: '#818cf8',
            cursor: isLocked ? 'text' : 'default',
          }}
        />
      </div>
      {/* Per-row reset */}
      {isChanged ? (
        <button onClick={onReset} className="shrink-0 px-2 text-[9px]" style={{ color: '#f43f5e' }}>✕</button>
      ) : (
        <span className="shrink-0 w-6" />
      )}
    </div>
  )
}


function StylesBlock({ styles, cssVars, isLocked }: {
  styles: Record<string, string>
  cssVars: Record<string, string>
  isLocked: boolean
}) {
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...styles }))
  const [changed, setChanged] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)

  useEffect(() => { setValues({ ...styles }); setChanged({}) }, [styles])

  function handleChange(prop: string, val: string) {
    if (!isLocked) return
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
    setValues({ ...styles }); setChanged({})
    for (const [p, v] of Object.entries(styles)) sendStyleUpdate(p, v)
  }

  function handleCopy() {
    copyToClipboard(Object.entries(values).map(([p, v]) => `  ${p}: ${v};`).join('\n'))
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  const anyChanged = Object.values(changed).some(Boolean)
  const entries = Object.entries(values)

  return (
    <div className="px-3 pb-3 flex flex-col flex-1">
      <div className="flex items-center gap-2 pb-2">
        <button onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors"
          style={{ background: copied ? '#10b98118' : S.surface, color: copied ? '#10b981' : S.sub, border: `1px solid ${copied ? '#10b98144' : S.border}` }}>
          {copied ? <Check size={9} /> : <Copy size={9} />}{copied ? 'Copied!' : 'Copy all'}
        </button>
        {anyChanged && (
          <button onClick={handleResetAll}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg"
            style={{ background: '#f43f5e10', color: '#f43f5e', border: '1px solid #f43f5e33' }}>
            Reset all
          </button>
        )}
        <span className="text-[10px] ml-auto" style={{ color: anyChanged ? '#818cf8' : S.sub }}>
          {anyChanged ? '● live editing' : isLocked ? 'Click value to edit' : 'Lock element to edit'}
        </span>
      </div>

      <div className="rounded-xl overflow-hidden"
           style={{ background: '#0f172a', border: `1px solid ${anyChanged ? '#6366f155' : '#1e293b'}` }}>
        {entries.map(([prop, val], i) => (
          <StyleRow
            key={prop}
            prop={prop}
            val={val}
            isChanged={!!changed[prop]}
            isLocked={isLocked}
            onchange={v => handleChange(prop, v)}
            onReset={() => handleResetProp(prop)}
            isLast={i === entries.length - 1}
          />
        ))}
      </div>

      <VarsTable cssVars={cssVars} />
    </div>
  )
}

// ─── HTML syntax highlighter ──────────────────────────────────────────────────
function highlightHtml(html: string): React.ReactNode[] {
  return html.split('\n').map((line, li) => {
    const nodes: React.ReactNode[] = []
    let lastIdx = 0
    let m: RegExpExecArray | null
    const re = /(<\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)(\/?>)|(<!--[\s\S]*?-->)/g

    while ((m = re.exec(line)) !== null) {
      if (m.index > lastIdx) {
        nodes.push(<span key={`t${m.index}`} style={{ color: '#94a3b8' }}>{line.slice(lastIdx, m.index)}</span>)
      }
      if (m[5]) {
        nodes.push(<span key={`cm${m.index}`} style={{ color: '#64748b', fontStyle: 'italic' }}>{m[5]}</span>)
      } else {
        nodes.push(<span key={`b${m.index}`} style={{ color: '#64748b' }}>{m[1]}</span>)
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
              attrNodes.push(<span key={`av${am.index}`} style={{ color: '#a5f3fc' }}>"{attrVal}"</span>)
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

// ─── HTML editor ─────────────────────────────────────────────────────────────
function HTMLBlock({ html, isLocked }: { html: string; isLocked: boolean }) {
  const [code, setCode] = useState(html)
  const [edited, setEdited] = useState(false)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)

  useEffect(() => { if (!edited) setCode(html) }, [html])

  function syncScroll() {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop
      preRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (!isLocked) return
    setCode(e.target.value)
    setEdited(true)
    window.parent.postMessage({ source: 'devlens-panel', type: 'APPLY_OUTERHTML', html: e.target.value }, '*')
  }

  function handleReset() {
    setCode(html)
    setEdited(false)
    window.parent.postMessage({ source: 'devlens-panel', type: 'APPLY_OUTERHTML', html }, '*')
  }

  function handleCopy() {
    copyToClipboard(code)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  const editorHeight = Math.max(160, code.split('\n').length * 20 + 24)
  // Memoize syntax highlighting — avoid rebuilding all React nodes on every keystroke
  const highlighted = useMemo(() => highlightHtml(code), [code])

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 pb-2">
        <button onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors"
          style={{ background: copied ? '#10b98118' : S.surface, color: copied ? '#10b981' : S.sub, border: `1px solid ${copied ? '#10b98144' : S.border}` }}>
          {copied ? <Check size={9} /> : <Copy size={9} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
        {edited && (
          <button onClick={handleReset}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors"
            style={{ background: '#f43f5e10', color: '#f43f5e', border: '1px solid #f43f5e33' }}>
            Reset
          </button>
        )}
        <span className="text-[10px] ml-auto" style={{ color: edited ? '#818cf8' : S.sub }}>
          {edited ? '● live editing' : isLocked ? 'Click to edit' : 'Lock element to edit'}
        </span>
      </div>
      <div className="relative rounded-xl overflow-hidden"
           style={{ height: editorHeight, background: '#0f172a', border: `1px solid ${edited ? '#6366f155' : '#1e293b'}` }}>
        <pre ref={preRef} aria-hidden
          className="absolute inset-0 px-3 py-2.5 text-[11px] font-mono pointer-events-none overflow-hidden m-0 whitespace-pre-wrap break-all leading-5">
          {highlighted}
        </pre>
        <textarea
          ref={textareaRef}
          value={code}
          onChange={handleChange}
          onScroll={syncScroll}
          readOnly={!isLocked}
          spellCheck={false}
          className="absolute inset-0 w-full h-full px-3 py-2.5 text-[11px] font-mono resize-none outline-none bg-transparent leading-5"
          style={{ color: 'transparent', caretColor: '#818cf8', cursor: isLocked ? 'text' : 'default', zIndex: 1 }}
        />
      </div>
    </div>
  )
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function sendNavigate(direction: 'ancestor' | 'child', payload: { steps?: number; childIndex?: number }) {
  window.parent.postMessage({ source: 'devlens-panel', type: 'NAVIGATE_TO', direction, ...payload }, '*')
}

function pillLabel(node: BreadcrumbNode) {
  if (node.id) return `#${node.id}`
  if (node.classes.length) return `.${node.classes[0]}`
  return node.tag.toUpperCase()
}

function BreadcrumbNav({ data, isLocked }: { data: InspectorElementData; isLocked: boolean }) {
  const totalAncestors = data.ancestors.length

  function goToAncestor(ancestorIndex: number) {
    sendNavigate('ancestor', { steps: totalAncestors - ancestorIndex })
  }

  const elementLabel = data.tagName.toUpperCase()
    + (data.id ? `#${data.id}` : '')
    + data.classes.slice(0, 2).map(c => `.${c}`).join('')

  return (
    <div className="px-3 pb-2 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl"
           style={{ background: S.surface, border: `1px solid ${isLocked ? '#f59e0b55' : S.border}` }}>
        <span className="text-[11px] font-mono font-bold flex-1 truncate" style={{ color: '#6366f1' }}>
          {elementLabel}
        </span>
        {isLocked && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md shrink-0"
                style={{ background: '#f59e0b18', color: '#f59e0b' }}>locked</span>
        )}
      </div>

      <div className="flex items-center overflow-x-auto px-1" style={{ scrollbarWidth: 'none' }}>
        {data.ancestors.slice(-2).map((ancestor, i) => {
          // Compute the real index in the full ancestors array, not the sliced one
          const realIndex = data.ancestors.length - 2 + i
          return (
          <React.Fragment key={`a-${realIndex}`}>
            {isLocked ? (
              <button
                onClick={() => goToAncestor(realIndex)}
                title={`Go to <${ancestor.tag}>`}
                className="text-[10px] font-mono whitespace-nowrap px-1 py-0.5 rounded shrink-0 transition-colors"
                style={{ color: S.sub }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#818cf8'; (e.currentTarget as HTMLButtonElement).style.background = '#6366f115' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = S.sub; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                {pillLabel(ancestor)}
              </button>
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

        {isLocked && data.children.slice(0, 2).map((child, i) => (
          <React.Fragment key={`c-${i}`}>
            <ChevronRight size={8} style={{ color: S.sub, flexShrink: 0, opacity: 0.4 }} />
            <button
              onClick={() => sendNavigate('child', { childIndex: i })}
              title={`Go to <${child.tag}>`}
              className="text-[10px] font-mono whitespace-nowrap px-1 py-0.5 rounded shrink-0 transition-colors"
              style={{ color: S.sub }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#818cf8'; (e.currentTarget as HTMLButtonElement).style.background = '#6366f115' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = S.sub; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
              {pillLabel(child)}
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export default function InspectorPanel({ data, isActive }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('styles')
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === 'INSPECTOR_LOCKED') setIsLocked(true)
      if (e.data?.type === 'INSPECTOR_UNLOCKED') setIsLocked(false)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  function switchTab(tab: Tab) {
    setActiveTab(tab)
    window.parent.postMessage({ source: 'devlens-panel', type: 'SET_BOX_MODE', enabled: tab === 'box' }, '*')
  }

  const tabs = [
    { id: 'styles' as Tab, icon: <Palette size={12} />, label: 'Styles' },
    { id: 'box'    as Tab, icon: <Box size={12} />,     label: 'Box'    },
    { id: 'fonts'  as Tab, icon: <Type size={12} />,    label: 'Fonts'  },
    { id: 'html'   as Tab, icon: <Code size={12} />,    label: 'HTML'   },
  ]

  return (
    <div className="flex flex-col h-full">
      {!data ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 px-4 text-center">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#6366f122' }}>
            <Box size={18} style={{ color: '#6366f1' }} />
          </div>
          <p className="text-xs" style={{ color: S.sub }}>
            Hover over any element on the page to inspect it
          </p>
        </div>
      ) : (
        <>
          <BreadcrumbNav data={data} isLocked={isLocked} />

          <div className="grid px-3 gap-1 pb-2" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => switchTab(tab.id)}
                className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                style={{
                  background: activeTab === tab.id ? '#6366f122' : S.surface,
                  color: activeTab === tab.id ? '#818cf8' : S.sub,
                  border: `1px solid ${activeTab === tab.id ? '#6366f133' : S.border}`,
                }}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col">
            {activeTab === 'styles' && (
              <StylesBlock styles={data.computedStyles} cssVars={data.cssVars ?? {}} isLocked={isLocked} />
            )}

            {activeTab === 'box' && (
              <div className="p-3 flex flex-col gap-3">
                <div className="rounded-xl overflow-hidden text-[10px] font-mono" style={{ border: `1px solid ${S.border}` }}>
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
                  {[
                    ['Margin L/R', `${data.boxModel.marginLeft}px / ${data.boxModel.marginRight}px`],
                    ['Padding L/R', `${data.boxModel.paddingLeft}px / ${data.boxModel.paddingRight}px`],
                    ['Border', `${data.boxModel.borderTop}px`],
                    ['Position', `${Math.round(data.boxModel.left)}px, ${Math.round(data.boxModel.top)}px`],
                  ].map(([label, val]) => (
                    <div key={label} className="px-3 py-2 rounded-xl" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
                      <div className="text-[9px] mb-0.5" style={{ color: S.sub }}>{label}</div>
                      <div className="text-[11px] font-mono" style={{ color: '#6366f1' }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'fonts' && (
              <div className="pb-3">
                {[['Family', data.fonts.family], ['Size', data.fonts.size], ['Weight', data.fonts.weight], ['Line Height', data.fonts.lineHeight], ['Color', data.fonts.color]].map(([label, val]) => (
                  <div key={label} className="group py-0.5 px-2 rounded transition-colors"
                       style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', alignItems: 'center', gap: '4px' }}
                       onMouseEnter={e => (e.currentTarget.style.background = S.surface)}
                       onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span className="text-[11px] font-mono" style={{ color: S.sub }}>{label}</span>
                    <div className="min-w-0">
                      {label === 'Family' ? (
                        <a href="#"
                          onClick={e => {
                            e.preventDefault()
                            const name = val.replace(/['"]/g, '').split(',')[0].trim()
                            window.parent.postMessage({ source: 'devlens-panel', type: 'OPEN_URL', url: `https://fonts.google.com/specimen/${name.replace(/ /g, '+')}` }, '*')
                          }}
                          className="text-[11px] font-mono break-all transition-colors"
                          style={{ color: '#6366f1', textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: '#6366f166' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#818cf8')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#6366f1')}>
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
                ))}
                <div className="mx-2 mt-2 px-3 py-3 rounded-xl" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
                  <div className="text-[9px] mb-2" style={{ color: S.sub }}>PREVIEW</div>
                  <div style={{ fontFamily: data.fonts.family, fontSize: '15px', fontWeight: data.fonts.weight, color: S.text, lineHeight: data.fonts.lineHeight }}>
                    The quick brown fox
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'html' && (
              <HTMLBlock html={data.outerHTML} isLocked={isLocked} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
