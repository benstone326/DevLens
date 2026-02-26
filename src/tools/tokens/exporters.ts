import type { TokenSet } from './index'

export type ExportFormat = 'css' | 'tailwind' | 'json' | 'figma' | 'penpot'

export function exportTokens(tokens: TokenSet, format: ExportFormat): string {
  const enabled = {
    colors:     tokens.colors.filter(t => t.enabled),
    typography: tokens.typography.filter(t => t.enabled),
    spacing:    tokens.spacing.filter(t => t.enabled),
    shadows:    tokens.shadows.filter(t => t.enabled),
    radii:      tokens.radii.filter(t => t.enabled),
    breakpoints:tokens.breakpoints.filter(t => t.enabled),
  }

  if (format === 'css') return exportCSS(enabled)
  if (format === 'tailwind') return exportTailwind(enabled)
  if (format === 'figma') return exportFigma(enabled)
  if (format === 'penpot') return exportPenpot(enabled)
  return exportW3C(enabled)
}

function exportCSS(t: ReturnType<typeof filterEnabled>): string {
  const lines: string[] = [':root {']

  for (const c of t.colors)
    lines.push(`  --${c.name}: ${c.value};`)

  if (t.spacing.length) {
    lines.push('')
    for (const s of t.spacing)
      lines.push(`  --${s.name}: ${s.value};`)
  }

  if (t.radii.length) {
    lines.push('')
    for (const r of t.radii)
      lines.push(`  --${r.name}: ${r.value};`)
  }

  if (t.shadows.length) {
    lines.push('')
    for (const s of t.shadows)
      lines.push(`  --${s.name}: ${s.value};`)
  }

  lines.push('}')

  if (t.breakpoints.length) {
    lines.push('')
    lines.push('/* Breakpoints */')
    for (const bp of t.breakpoints)
      lines.push(`/* --${bp.name}: ${bp.value} — @media ${bp.query} */`)
  }

  return lines.join('\n')
}

function exportTailwind(t: ReturnType<typeof filterEnabled>): string {
  const colors: Record<string, string> = {}
  t.colors.forEach(c => { colors[c.name] = c.value })

  const spacing: Record<string, string> = {}
  t.spacing.forEach(s => { spacing[s.name] = s.value })

  const borderRadius: Record<string, string> = {}
  t.radii.forEach(r => { borderRadius[r.name] = r.value })

  const boxShadow: Record<string, string> = {}
  t.shadows.forEach(s => { boxShadow[s.name] = s.value })

  const screens: Record<string, string> = {}
  t.breakpoints.forEach(bp => { screens[bp.name] = bp.value })

  const config: Record<string, unknown> = { colors }
  if (Object.keys(spacing).length)      config.spacing = spacing
  if (Object.keys(borderRadius).length)  config.borderRadius = borderRadius
  if (Object.keys(boxShadow).length)     config.boxShadow = boxShadow
  if (Object.keys(screens).length)       config.screens = screens

  return `/** @type {import('tailwindcss').Config} */\nmodule.exports = {\n  theme: {\n    extend: ${JSON.stringify(config, null, 6).replace(/^/gm, '    ').trim()}\n  }\n}`
}

function exportW3C(t: ReturnType<typeof filterEnabled>): string {
  const tokens: Record<string, unknown> = {}

  if (t.colors.length) {
    tokens.color = {}
    t.colors.forEach(c => {
      // hex8 = #RRGGBBAA — valid in W3C token format and Token Studio
      (tokens.color as Record<string, unknown>)[c.name] = { $value: c.value, $type: 'color' }
    })
  }

  if (t.spacing.length) {
    tokens.spacing = {}
    t.spacing.forEach(s => {
      (tokens.spacing as Record<string, unknown>)[s.name] = { $value: s.value, $type: 'dimension' }
    })
  }

  if (t.radii.length) {
    tokens.borderRadius = {}
    t.radii.forEach(r => {
      (tokens.borderRadius as Record<string, unknown>)[r.name] = { $value: r.value, $type: 'dimension' }
    })
  }

  if (t.shadows.length) {
    tokens.shadow = {}
    t.shadows.forEach(s => {
      (tokens.shadow as Record<string, unknown>)[s.name] = { $value: s.value, $type: 'shadow' }
    })
  }

  if (t.typography.length) {
    tokens.typography = {}
    t.typography.forEach(ty => {
      (tokens.typography as Record<string, unknown>)[ty.name] = {
        $type: 'typography',
        $value: {
          fontFamily: ty.family,
          fontSize: ty.size,
          fontWeight: ty.weight,
          lineHeight: ty.lineHeight,
          letterSpacing: ty.letterSpacing,
        }
      }
    })
  }

  if (t.breakpoints.length) {
    tokens.breakpoint = {}
    t.breakpoints.forEach(bp => {
      (tokens.breakpoint as Record<string, unknown>)[bp.name] = { $value: bp.value, $type: 'dimension', $description: bp.query }
    })
  }

  return JSON.stringify(tokens, null, 2)
}

// Figma Token Studio format (compatible with Token Studio plugin for Figma)
function exportFigma(t: ReturnType<typeof filterEnabled>): string {
  const out: Record<string, unknown> = {}

  if (t.colors.length) {
    out['colors'] = {}
    t.colors.forEach(c => {
      (out['colors'] as Record<string, unknown>)[c.name] = {
        value: c.value, type: 'color'
      }
    })
  }

  if (t.typography.length) {
    out['typography'] = {}
    t.typography.forEach(ty => {
      (out['typography'] as Record<string, unknown>)[ty.name] = {
        value: {
          fontFamily: ty.family.replace(/['"]/g, '').split(',')[0].trim(),
          fontSize: ty.size,
          fontWeight: ty.weight,
          lineHeight: ty.lineHeight,
          letterSpacing: ty.letterSpacing,
        },
        type: 'typography'
      }
    })
  }

  if (t.spacing.length) {
    out['spacing'] = {}
    t.spacing.forEach(s => {
      (out['spacing'] as Record<string, unknown>)[s.name] = { value: s.value, type: 'spacing' }
    })
  }

  if (t.radii.length) {
    out['borderRadius'] = {}
    t.radii.forEach(r => {
      (out['borderRadius'] as Record<string, unknown>)[r.name] = { value: r.value, type: 'borderRadius' }
    })
  }

  if (t.shadows.length) {
    out['boxShadow'] = {}
    t.shadows.forEach(s => {
      (out['boxShadow'] as Record<string, unknown>)[s.name] = { value: s.value, type: 'boxShadow' }
    })
  }

  return JSON.stringify({ global: out }, null, 2)
}

// Penpot — W3C DTCG format with set-name wrapper (single JSON import)
// First-level key = set name, inner structure = W3C $value/$type
// Token names must use dots as separators, not hyphens
function exportPenpot(t: ReturnType<typeof filterEnabled>): string {
  // Penpot requires names like "color.primary" not "color-primary"
  const penpotName = (name: string) => name.replace(/-/g, '.')

  const set: Record<string, unknown> = {}

  if (t.colors.length) {
    set['color'] = {}
    t.colors.forEach(c => {
      (set['color'] as Record<string, unknown>)[penpotName(c.name)] = {
        $value: c.value,
        $type: 'color',
      }
    })
  }

  if (t.typography.length) {
    set['typography'] = {}
    t.typography.forEach(ty => {
      const cleanFamily = ty.family.replace(/['"]/g, '').split(',')[0].trim()
      ;(set['typography'] as Record<string, unknown>)[penpotName(ty.name)] = {
        $type: 'typography',
        $value: {
          fontFamily: cleanFamily,
          fontSize: ty.size,
          fontWeight: ty.weight,
          lineHeight: ty.lineHeight,
          letterSpacing: ty.letterSpacing,
        },
      }
    })
  }

  if (t.spacing.length) {
    set['spacing'] = {}
    t.spacing.forEach(s => {
      (set['spacing'] as Record<string, unknown>)[penpotName(s.name)] = {
        $value: s.value,
        $type: 'spacing',
      }
    })
  }

  if (t.radii.length) {
    set['borderRadius'] = {}
    t.radii.forEach(r => {
      (set['borderRadius'] as Record<string, unknown>)[penpotName(r.name)] = {
        $value: r.value,
        $type: 'borderRadius',
      }
    })
  }

  if (t.shadows.length) {
    set['shadow'] = {}
    t.shadows.forEach(s => {
      const parsed = parseCssShadow(s.value)
      ;(set['shadow'] as Record<string, unknown>)[penpotName(s.name)] = {
        $type: 'shadow',
        $value: parsed,
      }
    })
  }

  if (t.breakpoints.length) {
    set['breakpoint'] = {}
    t.breakpoints.forEach(bp => {
      (set['breakpoint'] as Record<string, unknown>)[penpotName(bp.name)] = {
        $value: bp.value,
        $type: 'dimension',
        $description: bp.query,
      }
    })
  }

  return JSON.stringify({ 'DevLens': set }, null, 2)
}

// Parse a CSS box-shadow string into Penpot's structured shadow object
function parseCssShadow(css: string): Record<string, unknown> {
  const inset = css.includes('inset')
  const clean = css.replace('inset', '').trim()

  // Extract color — try rgba first, then hex
  let color = '#000000'
  const rgbaMatch = clean.match(/rgba?\([^)]+\)/)
  if (rgbaMatch) color = rgbaMatch[0]
  else {
    const hexMatch = clean.match(/#[0-9a-fA-F]{3,8}/)
    if (hexMatch) color = hexMatch[0]
  }

  // Remove color from string and parse lengths
  const noColor = clean.replace(/rgba?\([^)]+\)/, '').replace(/#[0-9a-fA-F]{3,8}/, '').trim()
  const parts = noColor.split(/\s+/).filter(Boolean)
  const nums = parts.map(p => parseFloat(p) || 0)

  return {
    type: inset ? 'innerShadow' : 'dropShadow',
    color,
    x: nums[0] ?? 0,
    y: nums[1] ?? 0,
    blur: nums[2] ?? 0,
    spread: nums[3] ?? 0,
  }
}

// Helper type
type FilteredTokens = {
  colors: import('./index').ColorToken[]
  typography: import('./index').TypographyToken[]
  spacing: import('./index').SpacingToken[]
  shadows: import('./index').ShadowToken[]
  radii: import('./index').RadiusToken[]
  breakpoints: import('./index').BreakpointToken[]
}
type filterEnabled = FilteredTokens
