// ─── Types ────────────────────────────────────────────────────────────────────

export interface ColorToken {
  id: string
  name: string
  value: string          // normalized hex
  raw: string            // original value as found
  count: number          // how many times it appears
  enabled: boolean
}

export interface TypographyToken {
  id: string
  name: string
  family: string
  size: string
  weight: string
  lineHeight: string
  letterSpacing: string
  enabled: boolean
}

export interface SpacingToken {
  id: string
  name: string
  value: string          // e.g. "8px"
  count: number
  enabled: boolean
}

export interface ShadowToken {
  id: string
  name: string
  value: string
  enabled: boolean
}

export interface RadiusToken {
  id: string
  name: string
  value: string
  count: number
  enabled: boolean
}

export interface BreakpointToken {
  id: string
  name: string
  value: string          // e.g. "768px"
  query: string          // full media query
  enabled: boolean
}

export interface TokenSet {
  colors:      ColorToken[]
  typography:  TypographyToken[]
  spacing:     SpacingToken[]
  shadows:     ShadowToken[]
  radii:       RadiusToken[]
  breakpoints: BreakpointToken[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0
function uid() { return `t${++_idCounter}` }

// Convert any CSS color to hex or hex8 (Figma-compatible)
// Returns null for: transparent, fully invisible, CSS vars, invalid
function toHex(color: string): string | null {
  if (!color || color === 'transparent' || color === 'initial' || color.includes('var(')) return null
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Parse rgba manually for alpha support
    const rgbaMatch = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/)
    if (rgbaMatch) {
      const r = Math.round(parseFloat(rgbaMatch[1]))
      const g = Math.round(parseFloat(rgbaMatch[2]))
      const b = Math.round(parseFloat(rgbaMatch[3]))
      const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1
      // Skip fully transparent
      if (a === 0) return null
      // Skip near-transparent noise (alpha < 0.04)
      if (a < 0.04) return null
      const toHexByte = (n: number) => n.toString(16).padStart(2, '0')
      if (a >= 0.99) return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`
      // Return hex8 for semi-transparent (Figma supports this)
      const aHex = Math.round(a * 255).toString(16).padStart(2, '0')
      return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}${aHex}`
    }

    // For named colors / hex — use canvas
    ctx.fillStyle = '#ff00ff' // magenta sentinel
    ctx.fillStyle = color
    const computed = ctx.fillStyle
    // If canvas returned magenta, the color was invalid
    if (computed === '#ff00ff' && color !== '#ff00ff' && color !== 'magenta') return null
    return computed
  } catch { return null }
}

// Parse hex (6 or 8 digit) to HSL — ignores alpha for similarity comparison
function hexToHsl(hex: string): [number, number, number] {
  const h6 = hex.slice(0, 7) // strip alpha if present
  const r = parseInt(h6.slice(1, 3), 16) / 255
  const g = parseInt(h6.slice(3, 5), 16) / 255
  const b = parseInt(h6.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h * 360, s * 100, l * 100]
}

function colorDistance(h1: string, h2: string): number {
  // Only merge fully opaque colors — semitransparent ones are intentionally different
  const isOpaque = (h: string) => h.length === 7
  if (!isOpaque(h1) || !isOpaque(h2)) return 1 // never merge rgba variants
  const [h1h, h1s, h1l] = hexToHsl(h1)
  const [h2h, h2s, h2l] = hexToHsl(h2)
  const dh = Math.min(Math.abs(h1h - h2h), 360 - Math.abs(h1h - h2h)) / 180
  const ds = Math.abs(h1s - h2s) / 100
  const dl = Math.abs(h1l - h2l) / 100
  return Math.sqrt(dh * dh + ds * ds + dl * dl)
}

function extractColors(value: string): string[] {
  return value.match(/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/g) || []
}

// Typography value is usable only if it's a concrete resolved value (px, pt, number)
function isConcreteSize(val: string): boolean {
  if (!val) return false
  if (val === 'inherit' || val === 'normal' || val === 'initial') return false
  if (val.includes('var(') || val.includes('calc(')) return false
  if (val.endsWith('em') || val.endsWith('%')) return false
  return true
}

// Shadow is a real shadow (not a Tailwind utility placeholder or CSS var chain)
function isRealShadow(val: string): boolean {
  if (!val || val === 'none' || val === 'initial') return false
  if (val.includes('var(--tw-')) return false
  if (val.startsWith('var(')) return false
  // Must contain at least one real length value
  if (!/\d+px/.test(val) && !/\d+\s+\d+/.test(val)) return false
  return true
}

// ─── Extraction ───────────────────────────────────────────────────────────────

function isDevLensEl(el: Element) {
  return el.id?.startsWith('devlens') || el.closest('#devlens-root')
}

export function extractTokens(): TokenSet {
  const rawColors   = new Map<string, number>()   // hex → count
  const rawSpacing  = new Map<string, number>()   // px value → count
  const rawRadii    = new Map<string, number>()
  const rawShadows  = new Set<string>()
  const rawBreaks   = new Map<string, string>()   // px value → full query
  const typeSigs    = new Map<string, { family: string; size: string; weight: string; lineHeight: string; letterSpacing: string; count: number }>()

  // ── Walk stylesheets ──────────────────────────────────────────────────────
  function processStyleRule(rule: CSSStyleRule) {
    const s = rule.style

    // Colors
    const colorProps = ['color','background-color','border-color','outline-color',
                        'text-decoration-color','border-top-color','border-right-color',
                        'border-bottom-color','border-left-color']
    for (const prop of colorProps) {
      const val = s.getPropertyValue(prop)
      if (!val || val.includes('var(')) continue
      for (const c of extractColors(val)) {
        const hex = toHex(c)
        if (hex) rawColors.set(hex, (rawColors.get(hex) ?? 0) + 1)
      }
    }

    // Spacing — margin, padding, gap
    const spacingProps = ['margin','margin-top','margin-right','margin-bottom','margin-left',
                          'padding','padding-top','padding-right','padding-bottom','padding-left',
                          'gap','row-gap','column-gap']
    for (const prop of spacingProps) {
      const val = s.getPropertyValue(prop)
      if (!val) continue
      const pxVals = val.match(/\d+(\.\d+)?px/g) || []
      for (const px of pxVals) {
        const n = parseFloat(px)
        if (n > 0 && n <= 128) rawSpacing.set(px, (rawSpacing.get(px) ?? 0) + 1)
      }
    }

    // Border radius
    const rval = s.getPropertyValue('border-radius')
    if (rval) {
      const pxVals = rval.match(/\d+(\.\d+)?px/g) || []
      for (const px of pxVals) {
        const n = parseFloat(px)
        if (n > 0) rawRadii.set(px, (rawRadii.get(px) ?? 0) + 1)
      }
      // Also catch % values
      const pctVals = rval.match(/\d+%/g) || []
      for (const pct of pctVals) rawRadii.set(pct, (rawRadii.get(pct) ?? 0) + 1)
    }

    // Shadows — only real ones
    const shadow = s.getPropertyValue('box-shadow')
    if (isRealShadow(shadow)) rawShadows.add(shadow.trim())

    // Typography — only concrete resolved values
    const family = s.getPropertyValue('font-family')
    const size   = s.getPropertyValue('font-size')
    const weight = s.getPropertyValue('font-weight')
    const lh     = s.getPropertyValue('line-height')
    const ls     = s.getPropertyValue('letter-spacing')
    // Skip inherit/var/em — not usable as tokens
    if (!family || family === 'inherit' || family.startsWith('var(')) return
    if (!size || !isConcreteSize(size)) return
    const resolvedLh = isConcreteSize(lh) ? lh : 'normal'
    const resolvedLs = isConcreteSize(ls) ? ls : '0px'
    const resolvedW  = weight && weight !== 'inherit' ? weight : '400'
    const sig = `${family}|${size}|${resolvedW}|${resolvedLh}|${resolvedLs}`
    const ex = typeSigs.get(sig)
    if (ex) ex.count++
    else typeSigs.set(sig, { family, size, weight: resolvedW, lineHeight: resolvedLh, letterSpacing: resolvedLs, count: 1 })
  }

  function processRule(rule: CSSRule) {
    if (rule instanceof CSSStyleRule) {
      processStyleRule(rule)
    } else if (rule instanceof CSSMediaRule) {
      // Breakpoints
      const media = rule.conditionText || rule.media.mediaText
      const match = media.match(/(\d+(?:\.\d+)?px)/)
      if (match) rawBreaks.set(match[1], media)
      // Still walk child rules
      for (let i = 0; i < rule.cssRules.length; i++) processRule(rule.cssRules[i])
    }
  }

  for (let si = 0; si < document.styleSheets.length; si++) {
    const sheet = document.styleSheets[si]
    if (sheet.href?.includes('devlens')) continue
    try {
      for (let ri = 0; ri < sheet.cssRules.length; ri++) processRule(sheet.cssRules[ri])
    } catch { /* cross-origin */ }
  }

  // ── Also sample key DOM elements ──────────────────────────────────────────
  const selectors = ['h1','h2','h3','h4','h5','h6','p','a','button','input','label','span','li']
  for (const sel of selectors) {
    const els = document.querySelectorAll(sel)
    els.forEach((el, idx) => {
      if (idx > 2 || isDevLensEl(el)) return
      const cs = window.getComputedStyle(el)
      // Colors from computed
      for (const prop of ['color','background-color','border-color']) {
        const val = cs.getPropertyValue(prop)
        if (val) {
          const hex = toHex(val)
          if (hex) rawColors.set(hex, (rawColors.get(hex) ?? 0) + 1)
        }
      }
      // Typography from computed styles — these are always fully resolved
      const family = cs.fontFamily
      const size   = cs.fontSize
      const weight = cs.fontWeight
      const lh     = cs.lineHeight
      const ls     = cs.letterSpacing
      if (family && size && isConcreteSize(size) && !family.startsWith('var(')) {
        const resolvedLh = isConcreteSize(lh) ? lh : 'normal'
        const resolvedLs = isConcreteSize(ls) ? ls : '0px'
        const sig = `${family}|${size}|${weight}|${resolvedLh}|${resolvedLs}`
        const ex = typeSigs.get(sig)
        if (ex) ex.count += 2
        else typeSigs.set(sig, { family, size, weight, lineHeight: resolvedLh, letterSpacing: resolvedLs, count: 2 })
      }
    })
  }

  // ─── Normalize & build token sets ─────────────────────────────────────────

  // Colors — deduplicate similar ones, sort by frequency
  const colorEntries = [...rawColors.entries()]
    .filter(([, count]) => count >= 1)
    .sort((a, b) => b[1] - a[1])

  const dedupedColors: Array<[string, number]> = []
  for (const [hex, count] of colorEntries) {
    const similar = dedupedColors.find(([h]) => colorDistance(h, hex) < 0.08)
    if (similar) { similar[1] += count }
    else dedupedColors.push([hex, count])
  }

  const colors: ColorToken[] = dedupedColors
    .sort((a, b) => b[1] - a[1])
    .map(([hex, count], i) => ({
      id: uid(), name: `color-${i + 1}`, value: hex, raw: hex, count, enabled: true
    }))

  // Smart name the top color
  if (colors[0]) colors[0].name = 'color-primary'
  if (colors[1]) colors[1].name = 'color-secondary'
  if (colors[2]) colors[2].name = 'color-accent'

  // Typography — sort by count, deduplicate by family+size
  const seenTypeSigs = new Set<string>()
  const typography: TypographyToken[] = [...typeSigs.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .filter(([, t]) => {
      const sig = `${t.family}|${t.size}`
      if (seenTypeSigs.has(sig)) return false
      seenTypeSigs.add(sig)
      return true
    })
    .slice(0, 12)
    .map(([, t], i) => ({
      id: uid(),
      name: `text-${i + 1}`,
      family: t.family,
      size: t.size,
      weight: t.weight,
      lineHeight: t.lineHeight,
      letterSpacing: t.letterSpacing,
      enabled: true,
    }))

  // Spacing — sort numerically, skip 1px (border noise), require 3+ uses
  const spacing: SpacingToken[] = [...rawSpacing.entries()]
    .filter(([val, count]) => count >= 3 && parseFloat(val) > 1)
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .map(([val, count], i) => ({
      id: uid(), name: `spacing-${i + 1}`, value: val, count, enabled: true
    }))

  // Shadows
  const shadows: ShadowToken[] = [...rawShadows]
    .slice(0, 8)
    .map((val, i) => ({
      id: uid(), name: `shadow-${i + 1}`, value: val, enabled: true
    }))

  // Radii
  const radii: RadiusToken[] = [...rawRadii.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .map(([val, count], i) => ({
      id: uid(), name: `radius-${i + 1}`, value: val, count, enabled: true
    }))

  // Breakpoints
  const breakpoints: BreakpointToken[] = [...rawBreaks.entries()]
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .map(([val, query], i) => ({
      id: uid(), name: `bp-${i + 1}`, value: val, query, enabled: true
    }))

  return { colors, typography, spacing, shadows, radii, breakpoints }
}
