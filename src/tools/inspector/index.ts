export interface BreadcrumbNode {
  tag: string
  id: string
  classes: string[]
  index: number   // position in ancestors array (0 = direct parent, etc.) or -1 for self
}

export interface InspectorElementData {
  tagName: string
  id: string
  classes: string[]
  computedStyles: Record<string, string>
  cssVars: Record<string, string>        // resolved values of all var(--x) found in matched rules
  ancestors: BreadcrumbNode[]
  children: BreadcrumbNode[]
  boxModel: {
    width: number; height: number; top: number; left: number
    marginTop: number; marginRight: number; marginBottom: number; marginLeft: number
    paddingTop: number; paddingRight: number; paddingBottom: number; paddingLeft: number
    borderTop: number; borderRight: number; borderBottom: number; borderLeft: number
  }
  fonts: { family: string; size: string; weight: string; lineHeight: string; color: string }
  outerHTML: string
}

// Properties to always exclude even if found in stylesheets (browser internals / noise)
const EXCLUDED_PROPS = new Set([
  '-webkit-font-smoothing', '-moz-osx-font-smoothing', '-webkit-tap-highlight-color',
  'box-sizing', 'border-collapse', 'border-spacing', 'caption-side', 'empty-cells',
  'pointer-events', 'user-select', '-webkit-user-select', 'appearance', '-webkit-appearance',
  'list-style', 'list-style-type', 'list-style-position', 'list-style-image',
  'table-layout', 'word-break', 'overflow-wrap', 'word-wrap',
  'quotes', 'content', 'counter-reset', 'counter-increment',
])

// Values to skip — browser defaults that add noise
const DEFAULT_VALUES = new Set([
  'none', 'normal', 'auto', '0px', '', 'visible', 'static', 'start',
  'inline', 'row', 'nowrap', '0', 'initial', 'currentcolor',
  'rgba(0, 0, 0, 0)', 'transparent', '0% 0%', 'separate', 'baseline',
])

// Read actual CSS rules that match an element from stylesheets
function getMatchedRules(el: Element): Record<string, string> {
  const result: Record<string, string> = {}

  for (let si = 0; si < document.styleSheets.length; si++) {
    const sheet = document.styleSheets[si]
    if (sheet.href?.includes('devlens')) continue
    let rules: CSSRuleList
    try { rules = sheet.cssRules } catch { continue }

    for (let ri = 0; ri < rules.length; ri++) {
      const rule = rules[ri]

      if (rule instanceof CSSStyleRule) {
        try {
          if (el.matches(rule.selectorText)) {
            applyDeclaration(rule.style, result)
          }
        } catch { /* invalid selector */ }
      } else if (rule instanceof CSSMediaRule) {
        // Include rules inside @media that currently match
        if (window.matchMedia(rule.conditionText).matches) {
          for (let ci = 0; ci < rule.cssRules.length; ci++) {
            const inner = rule.cssRules[ci]
            if (inner instanceof CSSStyleRule) {
              try {
                if (el.matches(inner.selectorText)) {
                  applyDeclaration(inner.style, result)
                }
              } catch { /* invalid selector */ }
            }
          }
        }
      }
    }
  }

  // Also layer in the element's own inline styles (highest priority)
  if ((el as HTMLElement).style?.length) {
    applyDeclaration((el as HTMLElement).style, result)
  }

  return result
}

function applyDeclaration(style: CSSStyleDeclaration, result: Record<string, string>) {
  for (let i = 0; i < style.length; i++) {
    const prop = style[i]
    // Skip Tailwind internal custom properties
    if (prop.startsWith('--tw-') || prop.startsWith('--ring-') || prop.startsWith('--scroll-')) continue
    if (EXCLUDED_PROPS.has(prop)) continue
    const val = style.getPropertyValue(prop).trim()
    if (!val || DEFAULT_VALUES.has(val)) continue
    // Skip values that are purely Tailwind internal var() chains (shadow, ring, etc.)
    if (/^var\(--tw-/.test(val) && !val.includes(',')) continue
    // Skip border-*-style: solid when it's just a Tailwind reset
    if (prop.startsWith('border-') && prop.endsWith('-style') && val === 'solid') continue
    // Skip border-*-color when value is just a var(--tw-*) reference  
    if (prop.startsWith('border-') && /^var\(--tw-/.test(val)) continue
    result[prop] = val
  }
}

function nodeToBreadcrumb(el: Element, index: number): BreadcrumbNode {
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || '',
    classes: Array.from(el.classList).slice(0, 3),
    index,
  }
}

function extractAncestors(el: Element): BreadcrumbNode[] {
  const ancestors: BreadcrumbNode[] = []
  let cur = el.parentElement
  while (cur && cur !== document.documentElement) {
    if (cur.id === 'devlens-root') break
    ancestors.unshift(nodeToBreadcrumb(cur, ancestors.length))
    cur = cur.parentElement
  }
  // Re-index so 0 = body-level, last = direct parent
  return ancestors.map((a, i) => ({ ...a, index: i }))
}

function extractChildren(el: Element): BreadcrumbNode[] {
  return Array.from(el.children)
    .filter(c => c.id !== 'devlens-root' && !(c as HTMLElement).id?.startsWith('devlens'))
    .slice(0, 12)
    .map((c, i) => nodeToBreadcrumb(c, i))
}

export function extractElementData(el: Element): InspectorElementData {
  const computed = window.getComputedStyle(el)
  const rect = el.getBoundingClientRect()

  // Use actual matched stylesheet rules — much cleaner than computed styles
  const computedStyles = getMatchedRules(el)

  // Collect all var(--x) references from matched styles and resolve them
  const cssVars: Record<string, string> = {}
  const VAR_RE = /var\((--[\w-]+)/g
  for (const val of Object.values(computedStyles)) {
    let m: RegExpExecArray | null
    while ((m = VAR_RE.exec(val)) !== null) {
      const name = m[1]
      if (name.startsWith('--tw-')) continue
      if (!cssVars[name]) {
        const resolved = computed.getPropertyValue(name).trim()
        if (resolved) cssVars[name] = resolved
      }
    }
  }

  return {
    tagName: el.tagName.toLowerCase(),
    id: el.id || '',
    classes: Array.from(el.classList),
    computedStyles,
    cssVars,
    ancestors: extractAncestors(el),
    children: extractChildren(el),
    boxModel: {
      width: rect.width, height: rect.height,
      top: rect.top + window.scrollY, left: rect.left + window.scrollX,
      marginTop:    parseFloat(computed.marginTop),
      marginRight:  parseFloat(computed.marginRight),
      marginBottom: parseFloat(computed.marginBottom),
      marginLeft:   parseFloat(computed.marginLeft),
      paddingTop:    parseFloat(computed.paddingTop),
      paddingRight:  parseFloat(computed.paddingRight),
      paddingBottom: parseFloat(computed.paddingBottom),
      paddingLeft:   parseFloat(computed.paddingLeft),
      borderTop:    parseFloat(computed.borderTopWidth),
      borderRight:  parseFloat(computed.borderRightWidth),
      borderBottom: parseFloat(computed.borderBottomWidth),
      borderLeft:   parseFloat(computed.borderLeftWidth),
    },
    fonts: {
      family: computed.fontFamily, size: computed.fontSize,
      weight: computed.fontWeight, lineHeight: computed.lineHeight, color: computed.color,
    },
    // Cap at 5000 chars — large DOMs would cause perf issues in the editor
    // HTMLBlock shows a warning banner when truncated
    outerHTML: (el as HTMLElement).outerHTML.length > 5000
      ? (el as HTMLElement).outerHTML.slice(0, 5000) + '\n<!-- [DevLens: truncated] -->'
      : (el as HTMLElement).outerHTML,
  }
}

// ─── Overlay ──────────────────────────────────────────────────────────────────
let overlay: HTMLDivElement | null = null      // locked element — amber
let hoverOverlay: HTMLDivElement | null = null  // hover preview — indigo
let hoverTooltip: HTMLDivElement | null = null  // tooltip for hover
let tooltip: HTMLDivElement | null = null
let boxOverlay: HTMLDivElement | null = null   // box model overlay
let isActive = false
let isLocked = false
let isBoxMode = false
let lastTarget: Element | null = null
let onDataCallback: ((data: InspectorElementData) => void) | null = null

export function setBoxMode(enabled: boolean) {
  isBoxMode = enabled
  if (!enabled && boxOverlay) boxOverlay.style.display = 'none'
}

// ─── Box model overlay ────────────────────────────────────────────────────────
function showBoxOverlay(el: Element) {
  if (!boxOverlay) return
  const computed = window.getComputedStyle(el)
  const rect = el.getBoundingClientRect()

  const mt = parseFloat(computed.marginTop)
  const mr = parseFloat(computed.marginRight)
  const mb = parseFloat(computed.marginBottom)
  const ml = parseFloat(computed.marginLeft)
  const pt = parseFloat(computed.paddingTop)
  const pr = parseFloat(computed.paddingRight)
  const pb = parseFloat(computed.paddingBottom)
  const pl = parseFloat(computed.paddingLeft)
  const bt = parseFloat(computed.borderTopWidth)
  const br = parseFloat(computed.borderRightWidth)
  const bb = parseFloat(computed.borderBottomWidth)
  const bl = parseFloat(computed.borderLeftWidth)

  // Outer rect (includes margin)
  const outerTop    = rect.top    - mt
  const outerLeft   = rect.left   - ml
  const outerWidth  = rect.width  + ml + mr
  const outerHeight = rect.height + mt + mb

  const fmt = (n: number) => n === 0 ? '' : String(Math.round(n))

  boxOverlay.innerHTML = ''
  boxOverlay.style.cssText = `
    position:fixed;pointer-events:none;z-index:2147483646;
    top:${outerTop}px;left:${outerLeft}px;
    width:${outerWidth}px;height:${outerHeight}px;
    display:block;
  `

  // Helper: create a labeled zone layer
  function zone(
    color: string,
    top: number, right: number, bottom: number, left: number,
    labels: { t?: string; r?: string; b?: string; l?: string }
  ) {
    const d = document.createElement('div')
    d.style.cssText = `
      position:absolute;pointer-events:none;
      top:${top}px;right:${right}px;bottom:${bottom}px;left:${left}px;
      background:${color};
    `
    // Label each side
    const positions: Array<[keyof typeof labels, string]> = [['t','top'],['r','right'],['b','bottom'],['l','left']]
    for (const [k, side] of positions) {
      const val = labels[k]
      if (!val) continue
      const lbl = document.createElement('span')
      lbl.textContent = val
      lbl.style.cssText = `
        position:absolute;font-family:monospace;font-size:10px;font-weight:600;
        color:rgba(0,0,0,0.65);line-height:1;white-space:nowrap;
        ${side === 'top'    ? 'top:2px;left:50%;transform:translateX(-50%)' : ''}
        ${side === 'bottom' ? 'bottom:2px;left:50%;transform:translateX(-50%)' : ''}
        ${side === 'left'   ? 'left:3px;top:50%;transform:translateY(-50%)' : ''}
        ${side === 'right'  ? 'right:3px;top:50%;transform:translateY(-50%)' : ''}
      `
      d.appendChild(lbl)
    }
    return d
  }

  // Margin layer (outermost, orange)
  const marginZone = zone(
    'rgba(246,178,107,0.35)',
    0, 0, 0, 0,
    { t: fmt(mt), r: fmt(mr), b: fmt(mb), l: fmt(ml) }
  )
  boxOverlay.appendChild(marginZone)

  // Border layer (inside margin, yellow)
  const borderZone = zone(
    'rgba(255,229,100,0.25)',
    mt, mr, mb, ml,
    { t: fmt(bt), r: fmt(br), b: fmt(bb), l: fmt(bl) }
  )
  boxOverlay.appendChild(borderZone)

  // Padding layer (inside border, green)
  const paddingZone = zone(
    'rgba(147,196,125,0.4)',
    mt + bt, mr + br, mb + bb, ml + bl,
    { t: fmt(pt), r: fmt(pr), b: fmt(pb), l: fmt(pl) }
  )
  boxOverlay.appendChild(paddingZone)

  // Content layer (innermost, blue)
  const contentW = Math.round(rect.width  - bl - br - pl - pr)
  const contentH = Math.round(rect.height - bt - bb - pt - pb)
  const contentZone = document.createElement('div')
  contentZone.style.cssText = `
    position:absolute;pointer-events:none;
    top:${mt + bt + pt}px;left:${ml + bl + pl}px;
    width:${contentW}px;height:${contentH}px;
    background:rgba(111,168,220,0.35);
    display:flex;align-items:center;justify-content:center;
  `
  const contentLabel = document.createElement('span')
  contentLabel.textContent = `${contentW} × ${contentH}`
  contentLabel.style.cssText = `font-family:monospace;font-size:10px;font-weight:600;color:rgba(0,0,0,0.65);`
  contentZone.appendChild(contentLabel)
  boxOverlay.appendChild(contentZone)
}

function onMouseMove(e: MouseEvent) {
  // Suppress all highlighting during panel drag
  if ((window as any).__devlens_inspector_enabled === false) return
  const target = e.target as Element
  if (!target || target.closest('#devlens-root') || target.id === 'devlens-inspector-overlay') return
  if (isLocked) {
    // Show hover highlight without touching locked overlay or panel data
    highlightHover(target)
    return
  }
  lastTarget = target
  highlightElement(target)
  onDataCallback?.(extractElementData(target))
}

function onClick(e: MouseEvent) {
  const target = e.target as Element
  if (!target || target.closest('#devlens-root')) return
  e.preventDefault()
  e.stopPropagation()
  const iframe = (window as any).__devlens_iframe as HTMLIFrameElement | null

  if (isLocked && target === lastTarget) {
    isLocked = false
    hideHoverOverlay()
    if (overlay) overlay.style.borderColor = '#6366f1'
    iframe?.contentWindow?.postMessage({ type: 'INSPECTOR_UNLOCKED' }, '*')
  } else {
    isLocked = true
    lastTarget = target
    ;(window as any).__devlens_locked_el = target
    if (!(window as any).__devlens_original_styles)
      ;(window as any).__devlens_original_styles = (target as HTMLElement).getAttribute('style') ?? ''
    hideHoverOverlay()
    if (overlay) overlay.style.borderColor = '#f59e0b'
    highlightElement(target)
    onDataCallback?.(extractElementData(target))
    iframe?.contentWindow?.postMessage({ type: 'INSPECTOR_LOCKED' }, '*')
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') stopInspector()
}

function onScroll() {
  if (isLocked && lastTarget) highlightElement(lastTarget)
}

function highlightElement(el: Element) {
  if (!overlay || !tooltip) return
  const rect = el.getBoundingClientRect()

  if (isBoxMode) {
    overlay.style.display = 'none'
    tooltip.style.display = 'none'
    showBoxOverlay(el)
  } else {
    if (boxOverlay) boxOverlay.style.display = 'none'
    Object.assign(overlay.style, {
      top: `${rect.top}px`, left: `${rect.left}px`,
      width: `${rect.width}px`, height: `${rect.height}px`,
      display: 'block',
    })
    tooltip.textContent = el.tagName.toUpperCase()
    const tipTop = rect.top - 26
    Object.assign(tooltip.style, {
      top: `${tipTop < 4 ? rect.bottom + 4 : tipTop}px`,
      left: `${Math.min(Math.max(4, rect.left), window.innerWidth - 200)}px`,
      display: 'block',
    })
  }
}

function highlightHover(el: Element) {
  if (!hoverOverlay || !hoverTooltip) return
  const rect = el.getBoundingClientRect()

  if (isBoxMode) {
    hoverOverlay.style.display = 'none'
    hoverTooltip.style.display = 'none'
    showBoxOverlay(el)
  } else {
    if (boxOverlay) boxOverlay.style.display = 'none'
    Object.assign(hoverOverlay.style, {
      top: `${rect.top}px`, left: `${rect.left}px`,
      width: `${rect.width}px`, height: `${rect.height}px`,
      display: 'block',
    })
    hoverTooltip.textContent = el.tagName.toUpperCase()
    const tipTop = rect.top - 26
    Object.assign(hoverTooltip.style, {
      top: `${tipTop < 4 ? rect.bottom + 4 : tipTop}px`,
      left: `${Math.min(Math.max(4, rect.left), window.innerWidth - 200)}px`,
      display: 'block',
    })
  }
}

function hideHoverOverlay() {
  if (hoverOverlay) hoverOverlay.style.display = 'none'
  if (hoverTooltip) hoverTooltip.style.display = 'none'
  if (boxOverlay && !isLocked) boxOverlay.style.display = 'none'
}

export function navigateLocked(el: Element) {
  lastTarget = el
  highlightElement(el)
}

export function startInspector(onData: (data: InspectorElementData) => void) {
  if (isActive) return
  isActive = true
  isLocked = false
  onDataCallback = onData

  overlay = document.createElement('div')
  overlay.id = 'devlens-inspector-overlay'
  overlay.style.cssText = `
    position:fixed;pointer-events:none;z-index:2147483646;
    border:2px solid #6366f1;background:rgba(99,102,241,0.08);
    border-radius:3px;display:none;
    box-shadow:0 0 0 1px rgba(99,102,241,0.2);
    transition:top .05s,left .05s,width .05s,height .05s;
  `

  hoverOverlay = document.createElement('div')
  hoverOverlay.style.cssText = `
    position:fixed;pointer-events:none;z-index:2147483645;
    border:1.5px dashed #6366f1;background:rgba(99,102,241,0.04);
    border-radius:3px;display:none;
    transition:top .05s,left .05s,width .05s,height .05s;
  `

  hoverTooltip = document.createElement('div')
  hoverTooltip.style.cssText = `
    position:fixed;pointer-events:none;z-index:2147483645;
    background:#6366f1cc;color:#fff;display:none;
    font-family:monospace;font-size:11px;
    padding:2px 8px;border-radius:4px;white-space:nowrap;
  `

  tooltip = document.createElement('div')
  tooltip.style.cssText = `
    position:fixed;pointer-events:none;z-index:2147483646;
    background:#6366f1;color:#fff;display:none;
    font-family:monospace;font-size:11px;
    padding:2px 8px;border-radius:4px;white-space:nowrap;
    box-shadow:0 2px 8px rgba(0,0,0,0.3);
  `

  boxOverlay = document.createElement('div')
  boxOverlay.id = 'devlens-box-overlay'
  boxOverlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483645;display:none;'
  document.documentElement.appendChild(boxOverlay)

  document.documentElement.appendChild(overlay)
  document.documentElement.appendChild(hoverOverlay)
  document.documentElement.appendChild(hoverTooltip)
  document.documentElement.appendChild(tooltip)
  document.addEventListener('mousemove', onMouseMove, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('scroll', onScroll, true)
}

export function stopInspector() {
  if (!isActive) return
  isActive = false
  isLocked = false
  onDataCallback = null
  overlay?.remove(); overlay = null
  hoverOverlay?.remove(); hoverOverlay = null
  hoverTooltip?.remove(); hoverTooltip = null
  tooltip?.remove(); tooltip = null
  boxOverlay?.remove(); boxOverlay = null
  document.removeEventListener('mousemove', onMouseMove, true)
  document.removeEventListener('click', onClick, true)
  document.removeEventListener('keydown', onKeyDown, true)
  window.removeEventListener('scroll', onScroll, true)
}
