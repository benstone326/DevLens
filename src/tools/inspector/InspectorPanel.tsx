import { copyToClipboard } from '../../shared/clipboard'
import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Copy, Check, Box, Type, Palette, Code, ChevronUp, ChevronDown, X, Lock } from 'lucide-react'
import { S } from '../../shared/theme'
import { postToParent } from '../../shared/messaging'
import { useHover } from '../../shared/hooks'
import type { InspectorElementData, BreadcrumbNode } from './index'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  data:      InspectorElementData | null
  _isActive: boolean
}

type Tab = 'styles' | 'box' | 'fonts' | 'html'

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
  _styleTimer = setTimeout(() => postToParent({ type: 'APPLY_STYLE', prop, value }), 50)
}

// ─── CopyButton ───────────────────────────────────────────────────────────────
function CopyButton({ text, size = 10, alwaysVisible = false }: { text: string; size?: number; alwaysVisible?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={e => { e.stopPropagation(); copyToClipboard(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className={`${alwaysVisible ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity p-0.5 rounded shrink-0`}
      style={{ color: copied ? '#10b981' : S.sub }}
      title="Copy"
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
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: part, flexShrink: 0,
                border: '1px solid rgba(255,255,255,0.2)',
                verticalAlign: 'middle', marginRight: 3, marginBottom: 1,
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

// ─── TailwindBar ──────────────────────────────────────────────────────────────
function TailwindBar({ hasTailwind, twClasses }: { hasTailwind: boolean; twClasses: string[] }) {
  const [copied, setCopied] = useState(false)
  if (!hasTailwind) return null
  const classStr = twClasses.join(' ')

  return (
    <div className="flex items-center gap-1.5 px-2 h-[22px] rounded" style={{ background: '#111827', border: '1px solid #374151' }}>
      <span className="text-[8px] font-extrabold shrink-0" style={{ color: '#0ea5e9' }}>TW</span>
      {twClasses.length === 0 ? (
        <span className="text-[10px] font-mono flex-1 truncate" style={{ color: '#475569', fontStyle: 'italic' }}>
          No classes detected
        </span>
      ) : (
        <span className="text-[10px] font-mono flex-1 truncate" style={{ color: '#0ea5e9' }}>{classStr}</span>
      )}
      {twClasses.length > 0 && (
        <button
          onClick={() => { copyToClipboard(classStr); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
          className="shrink-0 p-0.5 rounded transition-opacity"
          style={{ color: copied ? '#10b981' : '#6b7280' }}
          title="Copy Tailwind classes"
        >
          {copied ? <Check size={9} /> : <Copy size={9} />}
        </button>
      )}
    </div>
  )
}

// ─── StyleRow ────────────────────────────────────────────────────────────────
function StyleRow({ prop, val, isDisabled, isChanged, canEdit, onChange, onReset, onToggle, isLast }: {
  prop:       string
  val:        string
  isDisabled: boolean
  isChanged:  boolean
  canEdit:    boolean
  onChange:   (val: string) => void
  onReset:    () => void
  onToggle:   () => void
  isLast:     boolean
}) {
  const [focused, setFocused] = useState(false)
  const isColor    = /^(#|rgb|hsl|oklch)/i.test(val.trim())
  const isVar      = /^var\(/.test(val.trim())
  const valueColor = isChanged ? '#a5f3fc' : isVar ? '#c4b5fd' : '#fde68a'

  return (
    <div
      className="group flex items-center gap-1"
      style={{
        borderBottom: isLast ? 'none' : '1px solid #ffffff06',
        borderLeft:   isChanged ? '2px solid #6366f166' : '2px solid transparent',
        background:   isChanged ? '#6366f10c' : 'transparent',
        opacity:      isDisabled ? 0.45 : 1,
        padding:      '0 6px 0 4px',
        minHeight:    20,
      }}
    >
      {/* Checkbox — Chrome DevTools style */}
      <button
        onClick={onToggle}
        title={isDisabled ? 'Enable property' : 'Disable property'}
        className="shrink-0 flex items-center justify-center transition-colors"
        style={{ width: 10, height: 10, background: '#374151', border: 'none', cursor: 'pointer', borderRadius: 2, flexShrink: 0 }}
      >
        {!isDisabled && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4L3.5 6L6.5 2" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {/* Property name */}
      <span className="text-[11px] font-mono shrink-0 select-none leading-5 whitespace-nowrap"
            style={{ color: '#64748b', textDecoration: isDisabled ? 'line-through' : 'none' }}>
        {prop}:
      </span>

      {/* Editable value */}
      <div className="relative flex-1 min-w-0 leading-5 overflow-hidden">
        {!focused && (
          <div className="absolute inset-0 flex items-center text-[11px] font-mono pointer-events-none whitespace-nowrap overflow-hidden">
            <span style={{ color: valueColor, textDecoration: isDisabled ? 'line-through' : 'none' }}>
              <ValueWithSwatches value={val} />
            </span>
          </div>
        )}
        <input
          type="text" value={val}
          readOnly={!canEdit || isDisabled}
          spellCheck={false}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="relative w-full bg-transparent outline-none text-[11px] font-mono leading-5 overflow-hidden p-0"
          style={{ color: focused ? valueColor : 'transparent', caretColor: '#818cf8',
                   cursor: canEdit && !isDisabled ? 'text' : 'default' }}
        />
      </div>

      {/* Red X (reset changed) or copy button (unchanged) */}
      {isChanged ? (
        <button
          onClick={onReset}
          className="shrink-0 flex items-center justify-center"
          style={{ color: '#ef4444', width: 10, height: 10 }}
          title="Reset to original value"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      ) : (
        <CopyButton text={`${prop}: ${val}`} size={9} />
      )}
    </div>
  )
}

// ─── StyleGroup ───────────────────────────────────────────────────────────────
function StyleGroup({ label, entries, changed, disabled, canEdit, onChange, onReset, onToggle }: {
  label:    string
  entries:  [string, string][]
  changed:  Record<string, boolean>
  disabled: Record<string, boolean>
  canEdit:  boolean
  onChange: (prop: string, val: string) => void
  onReset:  (prop: string) => void
  onToggle: (prop: string) => void
}) {
  const [open, setOpen] = useState(true)
  const changedCount = entries.filter(([p]) => changed[p]).length

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-3 py-1 text-[9px] font-semibold tracking-widest uppercase"
        style={{ color: '#6b7280', background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <span style={{ color: '#374151', display: 'flex', alignItems: 'center' }}>
          {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </span>
        {label}
        <span className="ml-0.5 flex items-center justify-center font-mono font-bold rounded-full"
              style={{ width: 12, height: 12, fontSize: 9, background: '#e5e7eb', color: '#6b7280' }}>
          {entries.length}
        </span>
        {changedCount > 0 && (
          <span className="ml-auto px-1 rounded text-[8px]" style={{ background: '#6366f122', color: '#818cf8' }}>
            {changedCount} live
          </span>
        )}
      </button>
      {open && (
        <div className="rounded overflow-hidden"
             style={{ background: '#111827', border: `1px solid ${changedCount > 0 ? '#6366f155' : '#374151'}` }}>
          {entries.map(([prop, val], i) => (
            <StyleRow
              key={prop} prop={prop} val={val}
              isDisabled={!!disabled[prop]} isChanged={!!changed[prop]}
              canEdit={canEdit}
              onChange={v => onChange(prop, v)}
              onReset={() => onReset(prop)}
              onToggle={() => onToggle(prop)}
              isLast={i === entries.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── VarsBlock ────────────────────────────────────────────────────────────────
function VarsBlock({ cssVars }: { cssVars: Record<string, string> }) {
  const [open, setOpen] = useState(true)
  const entries = Object.entries(cssVars)
  if (!entries.length) return null
  return (
    <div className="mb-0.5">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-3 py-1 text-[9px] font-semibold tracking-widest uppercase"
        style={{ color: '#6b7280', background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <span style={{ color: '#374151', display: 'flex', alignItems: 'center' }}>
          {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </span>
        Variables
        <span className="ml-0.5 flex items-center justify-center font-mono font-bold rounded-full"
              style={{ width: 12, height: 12, fontSize: 9, background: '#e5e7eb', color: '#6b7280' }}>
          {entries.length}
        </span>
      </button>
      {open && (
        <div className="rounded overflow-hidden" style={{ background: '#111827', border: '1px solid #374151' }}>
          {entries.map(([name, val], i) => {
            const isColor = /^(#|rgb|hsl|oklch)/i.test(val.trim())
            return (
              <div key={name} className="group flex items-center gap-1.5 px-2 leading-5"
                   style={{ borderBottom: i === entries.length - 1 ? 'none' : '1px solid #ffffff06', minHeight: 20 }}>
                <span className="text-[11px] font-mono shrink-0" style={{ color: '#c4b5fd' }}>{name}:</span>
                <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
                  {isColor && (
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                                   background: val, border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                  )}
                  <span className="text-[11px] font-mono truncate" style={{ color: '#67e8f9' }}>{val}</span>
                </div>
                <CopyButton text={`${name}: ${val}`} size={9} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── A11y helpers ─────────────────────────────────────────────────────────────
function inferRole(tag: string): string {
  const roles: Record<string, string> = {
    a: 'link', button: 'button', nav: 'navigation', main: 'main',
    header: 'banner', footer: 'contentinfo', aside: 'complementary',
    section: 'region', article: 'article', form: 'form', img: 'img',
    input: 'textbox', select: 'listbox',
    h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading',
    ul: 'list', ol: 'list', li: 'listitem', table: 'table',
  }
  return roles[tag.toLowerCase()] ? `${roles[tag.toLowerCase()]} (implicit)` : 'none'
}

function relativeLuminance(color: string): number {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return 0
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const d = ctx.getImageData(0, 0, 1, 1).data
  const toLinear = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
  return 0.2126 * toLinear(d[0]) + 0.7152 * toLinear(d[1]) + 0.0722 * toLinear(d[2])
}

function computeContrast(fg: string, bg: string): number {
  try {
    const l1 = relativeLuminance(fg), l2 = relativeLuminance(bg)
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  } catch { return 0 }
}

function Badge({ pass, label, variant }: { pass: boolean; label: string; variant?: 'amber' }) {
  const col = variant === 'amber'
    ? { bg: 'rgba(245,158,11,0.3)', text: '#f59e0b' }
    : pass
      ? { bg: 'rgba(34,197,94,0.3)',  text: '#22c55e' }
      : { bg: 'rgba(239,68,68,0.3)',  text: '#ef4444' }
  return (
    <div className="flex items-center gap-0.5 px-1 py-0.5 rounded"
         style={{ background: col.bg }}>
      {/* amber variant (Missing) = text only per Figma 53:1082 */}
      {variant !== 'amber' && (
        pass
          ? <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke={col.text} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          : <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M2 2L6 6M6 2L2 6" stroke={col.text} strokeWidth="1.2" strokeLinecap="round"/></svg>
      )}
      <span className="text-[9px] font-bold" style={{ color: col.text }}>{label}</span>
    </div>
  )
}

// ─── A11yBlock ────────────────────────────────────────────────────────────────
function A11yBlock({ data }: { data: InspectorElementData }) {
  const contrast   = useMemo(() => computeContrast(data.fonts.color, data.computedStyles['background-color'] ?? '#fff'), [data])
  const passAA     = contrast >= 4.5
  const passAAA    = contrast >= 7
  const ariaLabel  = data.ariaLabel   // null = not set, string = value
  const role       = inferRole(data.tagName)

  return (
    <div className="mb-0.5">
      <div className="flex items-center px-3 py-1 text-[9px] font-semibold tracking-widest uppercase" style={{ color: '#6b7280' }}>
        A11Y
      </div>
      <div className="rounded overflow-hidden" style={{ background: '#111827', border: '1px solid #374151' }}>
        {/* Contrast */}
        <div className="flex items-center gap-2 px-2" style={{ borderBottom: '1px solid #ffffff06', minHeight: 20 }}>
          <span className="text-[11px] font-mono shrink-0" style={{ color: '#64748b', width: 80 }}>Contrast</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono" style={{ color: '#cbd5e1' }}>
              {contrast > 0 ? `${contrast.toFixed(1)}:1` : '—'}
            </span>
            {contrast > 0 && (
              <div className="flex items-center gap-1">
                <Badge pass={passAA}  label="AA" />
                <Badge pass={passAAA} label="AAA" />
              </div>
            )}
          </div>
        </div>
        {/* aria-label */}
        <div className="flex items-center gap-2 px-2" style={{ borderBottom: '1px solid #ffffff06', minHeight: 20 }}>
          <span className="text-[11px] font-mono shrink-0" style={{ color: '#64748b', width: 80 }}>aria-label</span>
          {ariaLabel !== null
            ? <span className="text-[11px] font-mono truncate" style={{ color: '#cbd5e1' }}>{ariaLabel || '""'}</span>
            : <Badge pass={false} label="Missing" variant="amber" />
          }
        </div>
        {/* role */}
        <div className="flex items-center gap-2 px-2" style={{ minHeight: 20 }}>
          <span className="text-[11px] font-mono shrink-0" style={{ color: '#64748b', width: 80 }}>role</span>
          <span className="text-[11px] font-mono" style={{ color: '#cbd5e1' }}>{role}</span>
        </div>
      </div>
    </div>
  )
}

// ─── StylesBlock ──────────────────────────────────────────────────────────────
function StylesBlock({ data, canEdit }: { data: InspectorElementData; canEdit: boolean }) {
  const { computedStyles: styles, cssVars, hasTailwind, twClasses } = data

  // Persists original values for disabled props across element re-visits
  const disabledOriginsRef = useRef<Record<string, string>>({})

  function initFromStyles(s: Record<string, string>) {
    const initValues: Record<string, string>  = {}
    const initDisabled: Record<string, boolean> = {}
    for (const [prop, val] of Object.entries(s)) {
      if (val === 'unset') {
        initDisabled[prop] = true
        initValues[prop] = disabledOriginsRef.current[prop] ?? val
      } else {
        initValues[prop] = val
      }
    }
    return { initValues, initDisabled }
  }

  const { initValues, initDisabled } = initFromStyles(styles)
  const [values,   setValues]   = useState<Record<string, string>>(() => initValues)
  const [changed,  setChanged]  = useState<Record<string, boolean>>({})
  const [disabled, setDisabled] = useState<Record<string, boolean>>(() => initDisabled)
  const [query,    setQuery]    = useState('')

  useEffect(() => {
    const { initValues, initDisabled } = initFromStyles(styles)
    setValues(initValues)
    setChanged({})
    setDisabled(initDisabled)
    setQuery('')
  }, [styles])

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

  function handleToggle(prop: string) {
    if (!canEdit) return
    const nowDisabled = !disabled[prop]
    setDisabled(d => ({ ...d, [prop]: nowDisabled }))
    if (nowDisabled) {
      // Store original so we can restore strikethrough display on re-visit
      disabledOriginsRef.current[prop] = values[prop]
      // Disabling — send empty value so content script injects unset !important
      postToParent({ type: 'APPLY_STYLE', prop, value: '' })
    } else {
      delete disabledOriginsRef.current[prop]
      // Re-enabling — send restore flag so content script only removes the
      // suppression rule without adding the value to element.style inline
      postToParent({ type: 'APPLY_STYLE', prop, value: values[prop], restore: true })
    }
  }

  const allEntries = Object.entries(values)
  const filtered   = query.trim()
    ? allEntries.filter(([p, v]) => p.includes(query.toLowerCase()) || v.toLowerCase().includes(query.toLowerCase()))
    : allEntries
  const groups = useMemo(() => groupStyles(filtered), [filtered])

  // Element selector label
  const selectorLabel = data.tagName
    + (data.id ? `#${data.id}` : '')
    + data.classes.slice(0, 2).map(c => `.${c}`).join('')

  return (
    // Figma node 10:238 — padding 12px all sides, gap 8px between items
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>

      {/* Filter bar — white bg, light border per Figma */}
      <div className="flex items-center gap-1 rounded px-1.5 h-[22px]"
           style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
        {/* filter/funnel icon 8×8 */}
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0 }}>
          <path d="M1 1.5h6M2 4h4M3 6.5h2" stroke="#6b7280" strokeWidth="1.1" strokeLinecap="round"/>
        </svg>
        <input
          type="text" value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter properties"
          className="flex-1 bg-transparent outline-none font-mono"
          style={{ color: '#374151', caretColor: '#6366f1', fontSize: 8 }}
          spellCheck={false}
        />
        {query && <button onClick={() => setQuery('')} style={{ color: '#9ca3af' }}><X size={8} /></button>}
      </div>

      {/* TW classes bar */}
      <TailwindBar hasTailwind={hasTailwind} twClasses={twClasses} />

      {/* Element style header */}
      <div className="flex items-center justify-between px-3 py-1 text-[9px] font-semibold tracking-widest uppercase"
           style={{ color: '#6b7280' }}>
        <span>Element Style</span>
        <span className="flex items-center gap-1 font-normal normal-case tracking-normal px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0 }}>
            <rect x="1.5" y="3.5" width="5" height="4" rx="0.75" fill="none" stroke="#f59e0b" strokeWidth="1.1"/>
            <path d="M2.5 3.5V2.5a1.5 1.5 0 013 0v1" stroke="#f59e0b" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 9 }}>{selectorLabel}</span>
        </span>
      </div>

      {/* Live CSS editor — applies on keystroke, resets per locked element */}
      <CustomCSSBlock canEdit={canEdit} data={data} />

      {/* CSS groups */}
      {filtered.length === 0 ? (
        <div className="text-[10px] text-center py-4" style={{ color: '#475569' }}>
          No properties match "{query}"
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {groups.map(group => (
            <StyleGroup
              key={group.label} label={group.label} entries={group.entries}
              changed={changed} disabled={disabled} canEdit={canEdit}
              onChange={handleChange} onReset={handleResetProp} onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      <VarsBlock cssVars={cssVars ?? {}} />
      <A11yBlock data={data} />
    </div>
  )
}

// ─── CSS Autocomplete data ────────────────────────────────────────────────────
// Comprehensive property list + value suggestions, matching DevTools behaviour
const CSS_PROPS: string[] = [
  'align-content','align-items','align-self','animation','animation-delay',
  'animation-direction','animation-duration','animation-fill-mode',
  'animation-iteration-count','animation-name','animation-play-state',
  'animation-timing-function','aspect-ratio',
  'backdrop-filter','background','background-attachment','background-clip',
  'background-color','background-image','background-origin','background-position',
  'background-repeat','background-size','border','border-bottom','border-bottom-color',
  'border-bottom-left-radius','border-bottom-right-radius','border-bottom-style',
  'border-bottom-width','border-collapse','border-color','border-image','border-left',
  'border-left-color','border-left-style','border-left-width','border-radius',
  'border-right','border-right-color','border-right-style','border-right-width',
  'border-spacing','border-style','border-top','border-top-color',
  'border-top-left-radius','border-top-right-radius','border-top-style',
  'border-top-width','border-width','bottom','box-shadow','box-sizing',
  'clip-path','color','column-gap','columns','content','cursor',
  'display','filter','flex','flex-basis','flex-direction','flex-flow',
  'flex-grow','flex-shrink','flex-wrap','float','font','font-family',
  'font-size','font-style','font-variant','font-weight',
  'gap','grid','grid-area','grid-auto-columns','grid-auto-flow','grid-auto-rows',
  'grid-column','grid-column-end','grid-column-gap','grid-column-start',
  'grid-row','grid-row-end','grid-row-gap','grid-row-start',
  'grid-template','grid-template-areas','grid-template-columns','grid-template-rows',
  'height','justify-content','justify-items','justify-self',
  'left','letter-spacing','line-height','list-style','list-style-type',
  'margin','margin-bottom','margin-left','margin-right','margin-top',
  'max-height','max-width','min-height','min-width',
  'object-fit','object-position','opacity','order','outline','outline-color',
  'outline-offset','outline-style','outline-width','overflow','overflow-x','overflow-y',
  'padding','padding-bottom','padding-left','padding-right','padding-top',
  'place-content','place-items','place-self','pointer-events','position',
  'resize','right','rotate','row-gap',
  'scroll-behavior','scroll-margin','scroll-margin-top','scroll-padding',
  'text-align','text-decoration','text-decoration-color','text-decoration-line',
  'text-decoration-style','text-indent','text-overflow','text-shadow',
  'text-transform','top','transform','transform-origin','transition',
  'transition-delay','transition-duration','transition-property',
  'transition-timing-function',
  'vertical-align','visibility','white-space','width','will-change',
  'word-break','word-spacing','z-index',
]

const CSS_VALUES: Record<string, string[]> = {
  display:          ['block','inline','inline-block','flex','inline-flex','grid','inline-grid','none','contents','flow-root','table'],
  position:         ['static','relative','absolute','fixed','sticky'],
  overflow:         ['visible','hidden','scroll','auto','clip'],
  'overflow-x':     ['visible','hidden','scroll','auto'],
  'overflow-y':     ['visible','hidden','scroll','auto'],
  'flex-direction': ['row','row-reverse','column','column-reverse'],
  'flex-wrap':      ['nowrap','wrap','wrap-reverse'],
  'justify-content':['flex-start','flex-end','center','space-between','space-around','space-evenly','start','end'],
  'align-items':    ['flex-start','flex-end','center','baseline','stretch','start','end'],
  'align-self':     ['auto','flex-start','flex-end','center','baseline','stretch'],
  'align-content':  ['flex-start','flex-end','center','space-between','space-around','stretch'],
  'flex-grow':      ['0','1','2'],
  'flex-shrink':    ['0','1'],
  visibility:       ['visible','hidden','collapse'],
  cursor:           ['auto','default','pointer','crosshair','move','text','wait','help','not-allowed','grab','grabbing','zoom-in','zoom-out','none'],
  'text-align':     ['left','right','center','justify','start','end'],
  'text-decoration':['none','underline','overline','line-through'],
  'text-transform': ['none','capitalize','uppercase','lowercase'],
  'text-overflow':  ['clip','ellipsis'],
  'white-space':    ['normal','nowrap','pre','pre-wrap','pre-line'],
  'word-break':     ['normal','break-all','keep-all','break-word'],
  'font-style':     ['normal','italic','oblique'],
  'font-weight':    ['100','200','300','400','500','600','700','800','900','bold','bolder','lighter','normal'],
  'font-variant':   ['normal','small-caps'],
  'object-fit':     ['fill','contain','cover','none','scale-down'],
  'box-sizing':     ['content-box','border-box'],
  'border-style':   ['none','solid','dashed','dotted','double','groove','ridge','inset','outset'],
  'border-collapse':['collapse','separate'],
  'resize':         ['none','both','horizontal','vertical'],
  'pointer-events': ['auto','none'],
  'will-change':    ['auto','transform','opacity','scroll-position','contents'],
  'scroll-behavior':['auto','smooth'],
  float:            ['none','left','right'],
  clear:            ['none','left','right','both'],
  'background-repeat':['repeat','repeat-x','repeat-y','no-repeat','space','round'],
  'background-attachment':['scroll','fixed','local'],
  'background-clip':['border-box','padding-box','content-box','text'],
  'background-origin':['border-box','padding-box','content-box'],
  'background-size':['auto','cover','contain'],
  'background-position':['center','top','bottom','left','right','top left','top right','bottom left','bottom right'],
  'list-style-type':['none','disc','circle','square','decimal','lower-alpha','upper-alpha','lower-roman','upper-roman'],
}

// Returns value colour matching DevTools — same as ValueWithSwatches
function cssValueColor(val: string, isChanged: boolean): string {
  if (isChanged) return '#a5f3fc'
  if (/^var\(/.test(val)) return '#c4b5fd'
  if (COLOR_RE.test(val)) return '#93c5fd'
  if (/^\d/.test(val) || /px|em|rem|vh|vw|%|deg|s$/.test(val)) return '#c4b5fd'
  return '#fde68a'
}

// ─── CssLineEditor — single editable line with prop+value autocomplete ─────────
interface CssLine { id: number; prop: string; value: string; disabled: boolean }

// Parse a raw style="" attribute string into CssLine array
function parseInlineStyle(raw: string, startId: number): CssLine[] {
  const lines: CssLine[] = []
  let id = startId
  const decls = raw.split(';').map(s => s.trim()).filter(Boolean)
  for (const decl of decls) {
    const colon = decl.indexOf(':')
    if (colon < 1) continue
    const prop  = decl.slice(0, colon).trim()
    const value = decl.slice(colon + 1).trim()
    if (prop && value) lines.push({ id: id++, prop, value, disabled: false })
  }
  return lines
}

function CssLineEditor({
  line, autoFocusProp, onPropChange, onValueChange, onToggle, onDelete, onAddAfter, applyLine,
}: {
  line:          CssLine
  autoFocusProp: boolean
  onPropChange:  (val: string) => void
  onValueChange: (val: string) => void
  onToggle:      () => void
  onDelete:      () => void
  onAddAfter:    () => void
  applyLine:     (prop: string, value: string) => void
}) {
  const propRef  = useRef<HTMLInputElement>(null)
  const valueRef = useRef<HTMLInputElement>(null)
  const [propSugs,  setPropSugs]  = useState<string[]>([])
  const [valueSugs, setValueSugs] = useState<string[]>([])
  const [propIdx,   setPropIdx]   = useState(-1)
  const [valueIdx,  setValueIdx]  = useState(-1)
  const [propFocus, setPropFocus] = useState(false)
  const [valFocus,  setValFocus]  = useState(false)

  useEffect(() => { if (autoFocusProp) propRef.current?.focus() }, [autoFocusProp])

  // ── Prop autocomplete ──────────────────────────────────────────────────────
  function onPropInput(raw: string) {
    onPropChange(raw)
    const q = raw.trim().toLowerCase()
    if (!q) { setPropSugs([]); return }
    const prefix = CSS_PROPS.filter(p => p.startsWith(q))
    const sub    = CSS_PROPS.filter(p => !p.startsWith(q) && p.includes(q))
    setPropSugs([...prefix, ...sub].slice(0, 10))
    setPropIdx(-1)
  }

  function selectProp(p: string) {
    onPropChange(p)
    setPropSugs([])
    setPropIdx(-1)
    setTimeout(() => valueRef.current?.focus(), 0)
  }

  function onPropKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (propSugs.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setPropIdx(i => Math.min(i + 1, propSugs.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setPropIdx(i => Math.max(i - 1, -1)); return }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        selectProp(propIdx >= 0 ? propSugs[propIdx] : propSugs[0])
        return
      }
      if (e.key === 'Escape') { setPropSugs([]); return }
    }
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); valueRef.current?.focus() }
    if (e.key === 'Backspace' && !line.prop) { onDelete() }
  }

  // ── Value autocomplete ─────────────────────────────────────────────────────
  function onValueInput(raw: string) {
    onValueChange(raw)
    const sugs = CSS_VALUES[line.prop] ?? []
    const q    = raw.trim().toLowerCase()
    setValueSugs(q ? sugs.filter(v => v.startsWith(q) || v.includes(q)).slice(0, 8) : sugs.slice(0, 8))
    setValueIdx(-1)
  }

  function selectValue(v: string) {
    onValueChange(v)
    setValueSugs([])
    setValueIdx(-1)
    applyLine(line.prop, v)
  }

  function onValueKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (valueSugs.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setValueIdx(i => Math.min(i + 1, valueSugs.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setValueIdx(i => Math.max(i - 1, -1)); return }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        selectValue(valueIdx >= 0 ? valueSugs[valueIdx] : valueSugs[0])
        return
      }
      if (e.key === 'Escape') { setValueSugs([]); return }
    }
    if (e.key === 'Enter') { e.preventDefault(); applyLine(line.prop, line.value); onAddAfter() }
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); applyLine(line.prop, line.value); onAddAfter() }
    if (e.key === 'Tab' && e.shiftKey)  { e.preventDefault(); propRef.current?.focus() }
    if (e.key === 'Backspace' && !line.value) { propRef.current?.focus() }
  }

  function onValueBlur() {
    setValFocus(false)
    setValueSugs([])
    if (line.prop && line.value) applyLine(line.prop, line.value)
  }

  const valueColor    = cssValueColor(line.value, false)
  const showPropDrop  = propFocus && propSugs.length > 0
  const showValDrop   = valFocus && valueSugs.length > 0

  return (
    <div
      className="relative flex items-center gap-1 group"
      style={{
        minHeight: 20, padding: '0 6px',
        opacity: line.disabled ? 0.45 : 1,
      }}
    >
      {/* ── Checkbox — same as StyleRow ── */}
      <button
        onMouseDown={e => { e.preventDefault(); onToggle() }}
        title={line.disabled ? 'Enable property' : 'Disable property'}
        className="shrink-0 flex items-center justify-center transition-colors"
        style={{ width: 10, height: 10, background: '#374151', border: 'none', cursor: 'pointer', borderRadius: 2, flexShrink: 0 }}
        tabIndex={-1}
      >
        {!line.disabled && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4L3.5 6L6.5 2" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {/* Prop input */}
      <div className="relative" style={{ flexShrink: 0 }}>
        <input
          ref={propRef}
          value={line.prop}
          onChange={e => onPropInput(e.target.value)}
          onKeyDown={onPropKeyDown}
          onFocus={() => { setPropFocus(true); onPropInput(line.prop) }}
          onBlur={() => { setPropFocus(false); setTimeout(() => setPropSugs([]), 120) }}
          spellCheck={false}
          placeholder="property"
          className="bg-transparent outline-none font-mono text-[11px] leading-5"
          style={{
            color: '#64748b',
            width: Math.max(60, line.prop.length * 7 + 8),
            caretColor: '#818cf8',
            textDecoration: line.disabled ? 'line-through' : 'none',
          }}
        />
        {/* Prop dropdown */}
        {showPropDrop && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 100,
            background: '#1e293b', border: '1px solid #374151',
            borderRadius: 4, minWidth: 180, maxHeight: 160, overflowY: 'auto',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}>
            {propSugs.map((s, i) => (
              <div key={s}
                onMouseDown={e => { e.preventDefault(); selectProp(s) }}
                style={{
                  padding: '2px 8px', fontSize: 11, fontFamily: 'monospace',
                  color: i === propIdx ? '#fff' : '#94a3b8',
                  background: i === propIdx ? '#6366f1' : 'transparent',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {s}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Colon separator */}
      <span style={{ color: '#475569', fontSize: 11, fontFamily: 'monospace', flexShrink: 0 }}>:</span>

      {/* Value input */}
      <div className="relative flex-1 min-w-0">
        <input
          ref={valueRef}
          value={line.value}
          onChange={e => onValueInput(e.target.value)}
          onKeyDown={onValueKeyDown}
          onFocus={() => { setValFocus(true); onValueInput(line.value) }}
          onBlur={onValueBlur}
          spellCheck={false}
          placeholder="value"
          className="w-full bg-transparent outline-none font-mono text-[11px] leading-5"
          style={{
            color: valueColor,
            caretColor: '#818cf8',
            textDecoration: line.disabled ? 'line-through' : 'none',
          }}
        />
        {/* Color preview swatch if value is a colour */}
        {COLOR_RE.test(line.value) && (
          <span style={{
            position: 'absolute', left: `${line.value.length * 7 + 2}px`, top: '50%',
            transform: 'translateY(-50%)',
            display: 'inline-block', width: 8, height: 8,
            borderRadius: '50%', background: line.value,
            border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0,
          }} />
        )}
        {/* Value dropdown */}
        {showValDrop && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 100,
            background: '#1e293b', border: '1px solid #374151',
            borderRadius: 4, minWidth: 140, maxHeight: 160, overflowY: 'auto',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}>
            {valueSugs.map((s, i) => (
              <div key={s}
                onMouseDown={e => { e.preventDefault(); selectValue(s) }}
                style={{
                  padding: '2px 8px', fontSize: 11, fontFamily: 'monospace',
                  color: i === valueIdx ? '#fff' : cssValueColor(s, false),
                  background: i === valueIdx ? '#6366f1' : 'transparent',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {s}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete — shown on row hover */}
      <button
        onMouseDown={e => { e.preventDefault(); onDelete() }}
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        style={{ color: '#475569', padding: '0 2px', lineHeight: 1 }}
        tabIndex={-1}
        title="Remove"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}

// ─── CustomCSSBlock ───────────────────────────────────────────────────────────
// Resets when the locked element changes (keyed on selector).
// Pre-populates from the element's existing inline style attribute.
// Checkbox toggles disable the property via the same unset !important mechanism.
function CustomCSSBlock({ canEdit, data }: { canEdit: boolean; data: InspectorElementData }) {
  // Derive a stable key from the locked element — forces full remount on change
  const elementKey = `${data.tagName}#${data.id}.${data.classes[0] ?? ''}`

  // Parse the element's existing inline styles as initial lines
  const initialLines = useMemo(() => {
    const parsed = parseInlineStyle(data.inlineStyle, 0)
    // Always have at least one empty line to type into
    return parsed.length > 0 ? parsed : [{ id: 0, prop: '', value: '', disabled: false }]
  }, [data.inlineStyle])

  const [lines,  setLines]  = useState<CssLine[]>(initialLines)
  const [nextId, setNextId] = useState(initialLines.length)
  const [newLineIdx, setNewLineIdx] = useState<number | null>(null)

  // Reset when element changes
  useEffect(() => {
    setLines(initialLines)
    setNextId(initialLines.length)
    setNewLineIdx(null)
  }, [elementKey, data.inlineStyle])

  function applyLine(prop: string, value: string) {
    if (!canEdit || !prop.trim() || !value.trim()) return
    window.parent.postMessage(
      { source: 'devlens-panel', type: 'APPLY_STYLE', prop: prop.trim(), value: value.trim() },
      '*'
    )
  }

  function toggleLine(id: number) {
    if (!canEdit) return
    setLines(ls => ls.map(l => {
      if (l.id !== id) return l
      const nowDisabled = !l.disabled
      if (nowDisabled) {
        // Disable — inject unset !important to suppress the inline style
        window.parent.postMessage(
          { source: 'devlens-panel', type: 'APPLY_STYLE', prop: l.prop, value: '' },
          '*'
        )
      } else {
        // Re-enable — for custom CSS props we must re-apply the value inline
        // (unlike stylesheet props where the cascade restores them automatically).
        // We remove the unset rule AND set the inline value back.
        window.parent.postMessage(
          { source: 'devlens-panel', type: 'APPLY_STYLE', prop: l.prop, value: l.value, reapply: true },
          '*'
        )
      }
      return { ...l, disabled: nowDisabled }
    }))
  }

  function updateProp(id: number, val: string) {
    setLines(ls => ls.map(l => l.id === id ? { ...l, prop: val } : l))
  }

  function updateValue(id: number, val: string) {
    setLines(ls => ls.map(l => l.id === id ? { ...l, value: val } : l))
  }

  function addAfter(id: number) {
    const nid = nextId
    setNextId(n => n + 1)
    setLines(ls => {
      const idx = ls.findIndex(l => l.id === id)
      const next = [...ls]
      next.splice(idx + 1, 0, { id: nid, prop: '', value: '', disabled: false })
      return next
    })
    setNewLineIdx(nid)
  }

  function deleteLine(id: number) {
    // Find the line first so we can remove it from the DOM before updating state
    const line = lines.find(l => l.id === id)
    if (line?.prop) {
      window.parent.postMessage(
        { source: 'devlens-panel', type: 'REMOVE_STYLE', prop: line.prop },
        '*'
      )
    }
    setLines(ls => {
      if (ls.length === 1) {
        const nid = nextId
        setNextId(n => n + 1)
        return [{ id: nid, prop: '', value: '', disabled: false }]
      }
      return ls.filter(l => l.id !== id)
    })
  }

  if (!canEdit) return null

  return (
    <div className="rounded overflow-visible"
         style={{ border: '1px solid #374151', background: '#111827' }}>
      <div style={{ padding: '4px 0' }}>
        {lines.map(line => (
          <CssLineEditor
            key={line.id}
            line={line}
            autoFocusProp={newLineIdx === line.id}
            onPropChange={v => updateProp(line.id, v)}
            onValueChange={v => updateValue(line.id, v)}
            onToggle={() => toggleLine(line.id)}
            onDelete={() => deleteLine(line.id)}
            onAddAfter={() => addAfter(line.id)}
            applyLine={applyLine}
          />
        ))}
      </div>
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
      if (m.index > lastIdx) nodes.push(<span key={`t${m.index}`} style={{ color: '#94a3b8' }}>{line.slice(lastIdx, m.index)}</span>)
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
    if (lastIdx < line.length) nodes.push(<span key="tail" style={{ color: '#94a3b8' }}>{line.slice(lastIdx)}</span>)
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

  useEffect(() => { if (!edited) setCode(html) }, [html, edited])

  function syncScroll() {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop  = textareaRef.current.scrollTop
      preRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }

  const highlighted  = useMemo(() => highlightHtml(code), [code])
  const editorHeight = Math.max(8, code.split('\n').length) * 20 + 24

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 pb-2">
        <button onClick={() => { copyToClipboard(code); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors"
                style={{ background: copied ? '#10b98118' : S.surface, color: copied ? '#10b981' : S.sub, border: `1px solid ${copied ? '#10b98144' : S.border}` }}>
          {copied ? <Check size={9} /> : <Copy size={9} />}{copied ? 'Copied!' : 'Copy'}
        </button>
        {edited && (
          <button onClick={() => { setCode(html); setEdited(false); postToParent({ type: 'APPLY_OUTERHTML', html }) }}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors"
                  style={{ background: '#f43f5e10', color: '#f43f5e', border: '1px solid #f43f5e33' }}>Reset</button>
        )}
        <span className="text-[10px] ml-auto" style={{ color: edited ? '#818cf8' : S.sub }}>
          {edited ? '● live editing' : canEdit ? 'Click to edit' : 'Lock element to edit'}
        </span>
      </div>
      <div className="relative rounded overflow-hidden"
           style={{ height: editorHeight, background: '#0f172a', border: `1px solid ${edited ? '#6366f155' : '#1e293b'}` }}>
        <pre ref={preRef} aria-hidden
             className="absolute inset-0 px-3 py-2.5 text-[11px] font-mono pointer-events-none m-0 leading-5"
             style={{ overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'normal', overflowWrap: 'anywhere' }}>
          {highlighted}
        </pre>
        <textarea ref={textareaRef} value={code}
          onChange={e => { if (!canEdit) return; setCode(e.target.value); setEdited(true); postToParent({ type: 'APPLY_OUTERHTML', html: e.target.value }) }}
          onScroll={syncScroll} readOnly={!canEdit} spellCheck={false}
          className="absolute inset-0 w-full h-full px-3 py-2.5 text-[11px] font-mono resize-none outline-none bg-transparent leading-5"
          style={{ color: 'transparent', caretColor: '#818cf8', cursor: canEdit ? 'text' : 'default',
                   zIndex: 1, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
        />
      </div>
    </div>
  )
}

// ─── BoxTab ────────────────────────────────────────────────────────────────────
function BoxTab({ data }: { data: InspectorElementData }) {
  const bm  = data.boxModel
  const fmt = (n: number) => `${Math.round(n)}px`
  const rows = [
    { label: 'Margin',  t: bm.marginTop,  r: bm.marginRight,  b: bm.marginBottom,  l: bm.marginLeft,  color: '#f59e0b', bg: '#f59e0b0e' },
    { label: 'Border',  t: bm.borderTop,  r: bm.borderRight,  b: bm.borderBottom,  l: bm.borderLeft,  color: '#14b8a6', bg: '#14b8a614' },
    { label: 'Padding', t: bm.paddingTop, r: bm.paddingRight, b: bm.paddingBottom, l: bm.paddingLeft, color: '#10b981', bg: '#10b98114' },
  ]
  return (
    <div className="p-3 flex flex-col gap-2">
      <div className="rounded px-4 py-3 flex items-center justify-between" style={{ background: '#6366f118', border: '1px solid #6366f133' }}>
        <span className="text-[10px]" style={{ color: S.sub }}>content</span>
        <span className="text-sm font-mono font-bold" style={{ color: '#818cf8' }}>{Math.round(bm.width)} × {Math.round(bm.height)}</span>
        <span className="text-[10px]" style={{ color: S.sub }}>{fmt(bm.left)}, {fmt(bm.top)}</span>
      </div>
      <div className="rounded overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
        <div className="grid text-[9px] px-3 py-1.5"
             style={{ gridTemplateColumns: '64px 1fr 1fr 1fr 1fr', color: '#334155', borderBottom: `1px solid ${S.border}`, background: S.surface }}>
          <span/><span className="text-center">top</span><span className="text-center">right</span>
          <span className="text-center">bottom</span><span className="text-center">left</span>
        </div>
        {rows.map(row => (
          <div key={row.label} className="grid items-center px-3 py-1.5 text-[11px] font-mono"
               style={{ gridTemplateColumns: '64px 1fr 1fr 1fr 1fr', background: row.bg, borderBottom: `1px solid ${S.border}` }}>
            <span className="text-[9px] font-sans font-semibold tracking-wide" style={{ color: row.color }}>{row.label.toUpperCase()}</span>
            {[row.t, row.r, row.b, row.l].map((v, i) => (
              <span key={i} className="text-center" style={{ color: v === 0 ? '#334155' : row.color }}>{fmt(v)}</span>
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
    <div className="group py-0.5 px-2 rounded transition-colors"
         style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', alignItems: 'center', gap: '4px',
                  background: hovered ? S.surface : 'transparent' }} {...hoverProps}>
      <span className="text-[11px] font-mono" style={{ color: S.sub }}>{label}</span>
      <div className="min-w-0">
        {label === 'Family' ? (
          <a href="#" onClick={e => { e.preventDefault(); const name = val.replace(/['"]/g, '').split(',')[0].trim(); postToParent({ type: 'OPEN_URL', url: `https://fonts.google.com/specimen/${name.replace(/ /g, '+')}` }) }}
             className="text-[11px] font-mono break-all transition-colors"
             style={{ color: '#6366f1', textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: '#6366f166' }}>
            {val}
          </a>
        ) : (
          <span className="text-[11px] font-mono break-all" style={{ color: '#6366f1' }}><ValueWithSwatches value={val} /></span>
        )}
      </div>
      <CopyButton text={val} />
    </div>
  )
}

function FontsTab({ data }: { data: InspectorElementData }) {
  const rows: [string, string][] = [
    ['Family', data.fonts.family], ['Size', data.fonts.size],
    ['Weight', data.fonts.weight], ['Line Height', data.fonts.lineHeight], ['Color', data.fonts.color],
  ]
  return (
    <div className="pb-3">
      {rows.map(([label, val]) => <FontRow key={label} label={label} val={val} />)}
      <div className="mx-2 mt-2 px-3 py-3 rounded" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
        <div className="text-[9px] mb-2" style={{ color: S.sub }}>PREVIEW</div>
        <div style={{ fontFamily: data.fonts.family, fontSize: '15px', fontWeight: data.fonts.weight, color: S.text, lineHeight: data.fonts.lineHeight }}>
          The quick brown fox
        </div>
      </div>
    </div>
  )
}

// ─── RelationsBar — replaces BreadcrumbNav ────────────────────────────────────
// Figma asset URLs for relation icons (node 56:1301 — updated icons)
const RELATION_ICONS: Record<string, string> = {
  'Parent':      'https://www.figma.com/api/mcp/asset/cd9d524e-27c3-4cc4-925f-fc42783a1705',
  'Child':       'https://www.figma.com/api/mcp/asset/635a998e-c6b9-4146-9bc2-edafd0f09f8b',
  'Sibling down':'https://www.figma.com/api/mcp/asset/411af076-b985-4c17-b155-40b3578daae1',
  'Sibling up':  'https://www.figma.com/api/mcp/asset/b5933cc7-7711-4287-a6a5-3c9f617a82d0',
}

function RelationPill({ label, node, canNavigate, onClick }: {
  label:       string
  node:        BreadcrumbNode | null
  canNavigate: boolean
  onClick:     () => void
}) {
  const [h, hp] = useHover()
  const disabled = !node || !canNavigate

  function pillLabel(n: BreadcrumbNode): string {
    if (n.id)             return `${n.tag}#${n.id}`
    if (n.classes.length) return `${n.tag}.${n.classes[0]}`
    return n.tag
  }

  return (
    <button
      onClick={!disabled ? onClick : undefined}
      className="flex items-center gap-1 w-full transition-colors"
      style={{
        background:   h && !disabled ? '#6366f115' : '#f9fafb',
        border:       `1px solid ${h && !disabled ? '#6366f133' : '#e5e7eb'}`,
        borderRadius: 2,
        padding:      '2px 4px',
        cursor:       disabled ? 'default' : 'pointer',
        minWidth:     0,
      }}
      {...hp}
    >
      {/* 8×8 Figma icon */}
      <img
        src={RELATION_ICONS[label]}
        width={8} height={8}
        style={{ flexShrink: 0, opacity: disabled ? 0.3 : 1 }}
        alt={label}
      />
      <span className="text-[9px] font-mono truncate" style={{ color: disabled ? '#9ca3af' : '#6b7280' }}>
        {disabled ? '—' : node ? pillLabel(node) : label}
      </span>
    </button>
  )
}

function RelationsBar({ data, canEdit }: {
  data:         InspectorElementData
  canEdit:      boolean
}) {
  const elementLabel = data.tagName.toUpperCase()
    + (data.id ? `#${data.id}` : '')
    + data.classes.slice(0, 2).map((c: string) => `.${c}`).join('')

  const parent      = data.ancestors[data.ancestors.length - 1] ?? null
  const child       = data.children[0] ?? null
  const siblingPrev = data.siblingPrev ?? null
  const siblingNext = data.siblingNext ?? null

  return (
    // Figma node 10:234 — bg gray-100, border-b gray-200, padding 12px
    <div style={{
      background:   '#f3f4f6',
      borderBottom: '1px solid #e5e7eb',
      padding:      12,
    }}>
      {/* Relations 2×2 grid — gap-x 8px, gap-y 4px per Figma
          TL: Parent | TR: Sibling down
          BL: Child  | BR: Sibling up                            */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: '1fr 1fr',
        columnGap:           8,
        rowGap:              4,
      }}>
        <RelationPill label="Parent"       node={parent}      canNavigate={canEdit}
          onClick={() => postToParent({ type: 'NAVIGATE_TO', direction: 'ancestor', steps: 1 })} />
        <RelationPill label="Sibling down" node={siblingNext} canNavigate={canEdit}
          onClick={() => postToParent({ type: 'NAVIGATE_TO', direction: 'sibling', delta: 1 })} />
        <RelationPill label="Child"        node={child}       canNavigate={canEdit}
          onClick={() => postToParent({ type: 'NAVIGATE_TO', direction: 'child', childIndex: 0 })} />
        <RelationPill label="Sibling up"   node={siblingPrev} canNavigate={canEdit}
          onClick={() => postToParent({ type: 'NAVIGATE_TO', direction: 'sibling', delta: -1 })} />
      </div>
    </div>
  )
}

// ─── InspectorPanel ───────────────────────────────────────────────────────────
export default function InspectorPanel({ data, _isActive }: Props) {
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

  function handleToggleLock() {
    if (canEdit) { postToParent({ type: 'UNLOCK_ELEMENT' }); setCanEdit(false) }
    else         { postToParent({ type: 'LOCK_ELEMENT' });   setCanEdit(true)  }
  }

  function switchTab(tab: Tab) {
    setActiveTab(tab)
    postToParent({ type: 'SET_BOX_MODE', enabled: tab === 'box' })
  }

  const tabs = [
    { id: 'styles' as Tab, icon: <Palette size={12} />, label: 'Styles' },
    { id: 'box'    as Tab, icon: <Box     size={12} />, label: 'Layout' },
    { id: 'fonts'  as Tab, icon: <Type    size={12} />, label: 'Fonts'  },
    { id: 'html'   as Tab, icon: <Code    size={12} />, label: 'HTML'   },
  ]

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 h-full gap-3 px-4 text-center">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#6366f122' }}>
          <Box size={18} style={{ color: '#6366f1' }} />
        </div>
        <p className="text-xs" style={{ color: S.sub }}>Hover over any element on the page to inspect it</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <RelationsBar data={data} canEdit={canEdit} />

      {/* Tabs — Figma node 57:1435: bg gray-100, border-b gray-200, gap 8px, each tab flex-1 */}
      <div className="flex" style={{
        background:   '#f3f4f6',
        borderBottom: '1px solid #e5e7eb',
        gap:          8,
      }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => switchTab(tab.id)}
                  className="flex items-center justify-center gap-1 text-[11px] font-medium transition-all"
                  style={{
                    flex:          '1 0 0',
                    color:         activeTab === tab.id ? '#6366f1' : '#6b7280',
                    background:    'transparent',
                    border:        'none',
                    borderBottom:  activeTab === tab.id ? '2px solid #6366f1' : '2px solid transparent',
                    padding:       '12px 8px',
                    marginBottom:  -1,
                    cursor:        'pointer',
                  }}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {activeTab === 'styles' && <StylesBlock data={data} canEdit={canEdit} />}
        {activeTab === 'box'    && <BoxTab   data={data} />}
        {activeTab === 'fonts'  && <FontsTab data={data} />}
        {activeTab === 'html'   && <HTMLBlock html={data.outerHTML} canEdit={canEdit} />}
      </div>
    </div>
  )
}
