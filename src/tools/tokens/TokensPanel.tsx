import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Scan, Copy, Check, Download, ChevronDown, RotateCcw } from 'lucide-react'
import type { TokenSet, ColorToken, TypographyToken, SpacingToken, ShadowToken, RadiusToken, BreakpointToken } from './index'
import { exportTokens, type ExportFormat } from './exporters'
import { S } from '../../shared/theme'
import { postToParent } from '../../shared/messaging'
import { useHover } from '../../shared/hooks'
import { copyToClipboard } from '../../shared/clipboard'

type Tab = 'colors' | 'typography' | 'spacing' | 'shadows' | 'radii' | 'breakpoints'

// ─── CopyBtn ──────────────────────────────────────────────────────────────────
function CopyBtn({ text, size = 10 }: { text: string; size?: number }) {
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

// ─── TokenName — inline editable ──────────────────────────────────────────────
function TokenName({ name, onChange }: { name: string; onChange: (n: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(name)

  function commit() { setEditing(false); if (val.trim()) onChange(val.trim()) }
  function cancel()  { setVal(name); setEditing(false) }

  if (editing) {
    return (
      <input
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
        className="text-[11px] font-mono px-1 py-0 rounded outline-none min-w-0 w-full max-w-[120px]"
        style={{ background: '#6366f118', color: '#818cf8', border: '1px solid #6366f144' }}
      />
    )
  }
  return (
    <span
      onClick={() => setEditing(true)}
      title="Click to rename"
      className="text-[11px] font-mono truncate cursor-text hover:text-indigo-400 transition-colors"
      style={{ color: '#818cf8' }}
    >
      --{name}
    </span>
  )
}

// ─── Toggle checkbox ──────────────────────────────────────────────────────────
function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="w-3.5 h-3.5 rounded shrink-0 transition-all border"
      style={{ background: enabled ? '#6366f1' : 'transparent', borderColor: enabled ? '#6366f1' : S.sub }}
    />
  )
}

// ─── TabBtn ───────────────────────────────────────────────────────────────────
function TabBtn({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg text-[10px] font-medium transition-all flex-1"
      style={{
        background: active ? '#6366f122' : 'transparent',
        color:      active ? '#818cf8'   : S.sub,
        border:    `1px solid ${active ? '#6366f133' : 'transparent'}`,
      }}
    >
      <span>{label}</span>
      <span className="text-[9px] font-mono" style={{ color: active ? '#6366f1' : S.sub }}>{count}</span>
    </button>
  )
}

// ─── HoverRow — base for list items that highlight on hover ───────────────────
// Replaces the inline onMouseEnter/Leave pattern across all token rows.
function HoverRow({ children, disabled = false }: { children: React.ReactNode; disabled?: boolean }) {
  const [hovered, hoverProps] = useHover()
  return (
    <div
      className="group flex items-center gap-2 py-1 px-2 rounded-lg transition-colors"
      style={{ opacity: disabled ? 0.4 : 1, background: hovered ? S.surface : 'transparent' }}
      {...hoverProps}
    >
      {children}
    </div>
  )
}

// ─── ColorRow ─────────────────────────────────────────────────────────────────
function ColorRow({ token, onName, onToggle }: { token: ColorToken; onName: (n: string) => void; onToggle: () => void }) {
  return (
    <HoverRow disabled={!token.enabled}>
      <Toggle enabled={token.enabled} onChange={onToggle} />
      <div className="w-6 h-6 rounded-md shrink-0 border" style={{ background: token.value, borderColor: S.border }} />
      <div className="flex-1 min-w-0">
        <TokenName name={token.name} onChange={onName} />
      </div>
      <span className="text-[10px] font-mono shrink-0" style={{ color: S.sub }}>{token.value}</span>
      <span className="text-[9px] shrink-0" style={{ color: S.sub }}>×{token.count}</span>
      <CopyBtn text={token.value} />
    </HoverRow>
  )
}

// ─── TypographyRow ────────────────────────────────────────────────────────────
function TypographyRow({ token, onName, onToggle }: { token: TypographyToken; onName: (n: string) => void; onToggle: () => void }) {
  const [open, setOpen] = useState(false)
  const [hovered, hoverProps] = useHover()
  const cleanFamily = token.family.replace(/['"]/g, '').split(',')[0].trim()

  return (
    <div style={{ opacity: token.enabled ? 1 : 0.4 }}>
      <div
        className="group flex items-center gap-2 py-1 px-2 rounded-lg transition-colors cursor-pointer"
        style={{ background: hovered ? S.surface : 'transparent' }}
        onClick={() => setOpen(o => !o)}
        {...hoverProps}
      >
        <Toggle enabled={token.enabled} onChange={e => { e.stopPropagation(); onToggle() }} />
        <div className="w-12 h-6 flex items-center justify-center shrink-0 rounded overflow-hidden"
             style={{ background: S.bgDeep }}>
          <span style={{ fontFamily: token.family, fontSize: '13px', fontWeight: token.weight, color: S.text, lineHeight: 1 }}>
            Aa
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <TokenName name={token.name} onChange={onName} />
          <div className="text-[10px] font-mono truncate" style={{ color: S.sub }}>
            {cleanFamily} · {token.size} · {token.weight}
          </div>
        </div>
        <ChevronDown size={10} style={{ color: S.sub, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
      </div>
      {open && (
        <div className="mx-2 mb-1 px-3 py-2 rounded-lg text-[10px] font-mono grid gap-1"
             style={{ background: S.bgDeep, gridTemplateColumns: '1fr 1fr' }}>
          {([
            ['family', token.family], ['size', token.size], ['weight', token.weight],
            ['line-height', token.lineHeight], ['letter-spacing', token.letterSpacing],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="group flex items-center gap-1">
              <span style={{ color: S.sub }}>{k}:</span>
              <span className="truncate" style={{ color: '#6366f1' }}>{v}</span>
              <CopyBtn text={`${k}: ${v}`} size={9} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ValueRow (spacing / radius / shadow / breakpoint) ───────────────────────
function ValueRow({ name, value, extra, enabled, onName, onToggle, copyText }: {
  name: string; value: string; extra?: string; enabled: boolean
  onName: (n: string) => void; onToggle: () => void; copyText: string
}) {
  return (
    <HoverRow disabled={!enabled}>
      <Toggle enabled={enabled} onChange={onToggle} />
      <div className="flex-1 min-w-0">
        <TokenName name={name} onChange={onName} />
      </div>
      <span className="text-[10px] font-mono truncate max-w-[120px]" style={{ color: '#6366f1' }} title={value}>{value}</span>
      {extra && <span className="text-[9px]" style={{ color: S.sub }}>{extra}</span>}
      <CopyBtn text={copyText} />
    </HoverRow>
  )
}

// ─── ExportBar ────────────────────────────────────────────────────────────────
function DownloadButton({ onClick }: { onClick: () => void }) {
  const [hovered, hoverProps] = useHover()
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all shrink-0"
      style={{
        background:   S.surface,
        color:        hovered ? '#818cf8' : S.sub,
        border:      `1px solid ${hovered ? '#6366f133' : S.border}`,
        transition:   'color 0.15s, border-color 0.15s',
      }}
      {...hoverProps}
    >
      <Download size={11} />
    </button>
  )
}

function RescanButton({ onClick }: { onClick: () => void }) {
  const [hovered, hoverProps] = useHover()
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors"
      style={{
        color:      hovered ? '#818cf8' : S.sub,
        background: S.surface,
        border:    `1px solid ${S.border}`,
      }}
      {...hoverProps}
    >
      <RotateCcw size={9} /> Rescan
    </button>
  )
}

function ExportBar({ tokens }: { tokens: TokenSet }) {
  const [format,   setFormat]   = useState<ExportFormat>('css')
  const [dropOpen, setDropOpen] = useState(false)
  const [copied,   setCopied]   = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropOpen) return
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropOpen])

  const formats: { id: ExportFormat; label: string; ext: string; desc: string }[] = [
    { id: 'css',      label: 'CSS Variables', ext: 'css',  desc: ':root { --token: value }' },
    { id: 'tailwind', label: 'Tailwind',       ext: 'js',   desc: 'theme.extend config'      },
    { id: 'json',     label: 'W3C JSON',       ext: 'json', desc: 'Style Dictionary format'  },
    { id: 'figma',    label: 'Figma',          ext: 'json', desc: 'Token Studio plugin'      },
    { id: 'penpot',   label: 'Penpot',         ext: 'json', desc: 'W3C DTCG · single file'   },
  ]

  const active = formats.find(f => f.id === format)!

  function getOutput() { return exportTokens(tokens, format) }

  function doCopy() {
    copyToClipboard(getOutput())
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  function doDownload() {
    const blob = new Blob([getOutput()], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `tokens.${active.ext}`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-3 py-2 flex items-center gap-2 shrink-0"
         style={{ borderTop: `1px solid ${S.border}` }}>

      {/* Format dropdown */}
      <div className="relative flex-1" ref={dropRef}>
        <button
          onClick={() => setDropOpen(o => !o)}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
          style={{ background: S.surface, color: S.text, border: `1px solid ${dropOpen ? '#6366f144' : S.border}` }}
        >
          <span className="flex-1 text-left">{active.label}</span>
          <ChevronDown size={11} style={{ color: S.sub, transform: dropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>

        {dropOpen && (
          <div
            className="absolute bottom-full mb-1 left-0 right-0 rounded-xl overflow-hidden z-50"
            style={{ background: S.bg, border: `1px solid ${S.border}`, boxShadow: '0 -8px 24px rgba(0,0,0,0.15)' }}
          >
            {formats.map((f, i) => (
              <FormatOption
                key={f.id}
                format={f}
                isActive={format === f.id}
                isLast={i === formats.length - 1}
                onClick={() => { setFormat(f.id); setDropOpen(false) }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Copy */}
      <button
        onClick={doCopy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all shrink-0"
        style={{
          background: copied ? '#10b98122' : '#6366f122',
          color:      copied ? '#10b981'   : '#818cf8',
          border:    `1px solid ${copied ? '#10b98133' : '#6366f133'}`,
        }}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? 'Copied!' : 'Copy'}
      </button>

      <DownloadButton onClick={doDownload} />
    </div>
  )
}

// Isolated dropdown row — each has its own hover state
function FormatOption({ format, isActive, isLast, onClick }: {
  format: { id: string; label: string; desc: string }
  isActive: boolean; isLast: boolean; onClick: () => void
}) {
  const [hovered, hoverProps] = useHover()
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
      style={{
        background:   isActive ? '#6366f118' : hovered ? S.surface : 'transparent',
        borderBottom: isLast ? 'none' : `1px solid ${S.border}`,
      }}
      {...hoverProps}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium" style={{ color: isActive ? '#818cf8' : S.text }}>{format.label}</div>
        <div className="text-[9px]" style={{ color: S.sub }}>{format.desc}</div>
      </div>
      {isActive && <Check size={10} style={{ color: '#6366f1', flexShrink: 0 }} />}
    </button>
  )
}

// ─── TokensPanel ──────────────────────────────────────────────────────────────
export default function TokensPanel() {
  const [tokens,    setTokens]    = useState<TokenSet | null>(null)
  const [scanning,  setScanning]  = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('colors')

  function scan() {
    setScanning(true)
    setTimeout(() => postToParent({ type: 'EXTRACT_TOKENS' }), 50)
  }

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === 'TOKENS_DATA') { setTokens(e.data.payload); setScanning(false) }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  const updateColor   = useCallback((id: string, patch: Partial<ColorToken>)      => setTokens(t => t ? { ...t, colors:      t.colors.map(c      => c.id === id ? { ...c, ...patch } : c) } : t), [])
  const updateTypo    = useCallback((id: string, patch: Partial<TypographyToken>)  => setTokens(t => t ? { ...t, typography:  t.typography.map(c  => c.id === id ? { ...c, ...patch } : c) } : t), [])
  const updateSpacing = useCallback((id: string, patch: Partial<SpacingToken>)     => setTokens(t => t ? { ...t, spacing:     t.spacing.map(c     => c.id === id ? { ...c, ...patch } : c) } : t), [])
  const updateShadow  = useCallback((id: string, patch: Partial<ShadowToken>)      => setTokens(t => t ? { ...t, shadows:     t.shadows.map(c     => c.id === id ? { ...c, ...patch } : c) } : t), [])
  const updateRadius  = useCallback((id: string, patch: Partial<RadiusToken>)      => setTokens(t => t ? { ...t, radii:       t.radii.map(c       => c.id === id ? { ...c, ...patch } : c) } : t), [])
  const updateBreak   = useCallback((id: string, patch: Partial<BreakpointToken>)  => setTokens(t => t ? { ...t, breakpoints: t.breakpoints.map(c => c.id === id ? { ...c, ...patch } : c) } : t), [])

  if (!tokens) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex flex-col items-center justify-center flex-1 gap-4 px-6 text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: '#6366f122' }}>
            <Scan size={22} style={{ color: '#6366f1' }} />
          </div>
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: S.text }}>Token Extractor</p>
            <p className="text-xs leading-relaxed" style={{ color: S.sub }}>
              Scan the page to extract colors, typography, spacing and more as design tokens
            </p>
          </div>
          <button
            onClick={scan}
            disabled={scanning}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: '#6366f1', color: '#fff', opacity: scanning ? 0.7 : 1 }}
          >
            <Scan size={14} className={scanning ? 'animate-spin' : ''} />
            {scanning ? 'Scanning…' : 'Scan Page'}
          </button>
        </div>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'colors',      label: 'Colors',  count: tokens.colors.length      },
    { id: 'typography',  label: 'Type',    count: tokens.typography.length  },
    { id: 'spacing',     label: 'Spacing', count: tokens.spacing.length     },
    { id: 'shadows',     label: 'Shadows', count: tokens.shadows.length     },
    { id: 'radii',       label: 'Radius',  count: tokens.radii.length       },
    { id: 'breakpoints', label: 'Breaks',  count: tokens.breakpoints.length },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-2 pb-1 flex items-center gap-2">
        <span className="text-[11px] flex-1" style={{ color: S.sub }}>
          {tokens.colors.length} colors · {tokens.typography.length} type · {tokens.spacing.length} spacing
        </span>
        <RescanButton onClick={() => { setTokens(null); scan() }} />
      </div>

      <div className="flex gap-1 px-3 pb-2">
        {tabs.map(t => (
          <TabBtn key={t.id} label={t.label} count={t.count} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-1">
        {activeTab === 'colors' && (tokens.colors.length === 0 ? <Empty label="No colors found" /> :
          tokens.colors.map(t => <ColorRow key={t.id} token={t} onName={n => updateColor(t.id, { name: n })} onToggle={() => updateColor(t.id, { enabled: !t.enabled })} />)
        )}
        {activeTab === 'typography' && (tokens.typography.length === 0 ? <Empty label="No typography found" /> :
          tokens.typography.map(t => <TypographyRow key={t.id} token={t} onName={n => updateTypo(t.id, { name: n })} onToggle={() => updateTypo(t.id, { enabled: !t.enabled })} />)
        )}
        {activeTab === 'spacing' && (tokens.spacing.length === 0 ? <Empty label="No spacing found" /> :
          tokens.spacing.map(t => <ValueRow key={t.id} name={t.name} value={t.value} extra={`×${t.count}`} enabled={t.enabled} copyText={`--${t.name}: ${t.value}`} onName={n => updateSpacing(t.id, { name: n })} onToggle={() => updateSpacing(t.id, { enabled: !t.enabled })} />)
        )}
        {activeTab === 'shadows' && (tokens.shadows.length === 0 ? <Empty label="No shadows found" /> :
          tokens.shadows.map(t => <ValueRow key={t.id} name={t.name} value={t.value} enabled={t.enabled} copyText={`--${t.name}: ${t.value}`} onName={n => updateShadow(t.id, { name: n })} onToggle={() => updateShadow(t.id, { enabled: !t.enabled })} />)
        )}
        {activeTab === 'radii' && (tokens.radii.length === 0 ? <Empty label="No radius tokens found" /> :
          tokens.radii.map(t => <ValueRow key={t.id} name={t.name} value={t.value} extra={`×${t.count}`} enabled={t.enabled} copyText={`--${t.name}: ${t.value}`} onName={n => updateRadius(t.id, { name: n })} onToggle={() => updateRadius(t.id, { enabled: !t.enabled })} />)
        )}
        {activeTab === 'breakpoints' && (tokens.breakpoints.length === 0 ? <Empty label="No breakpoints found" /> :
          tokens.breakpoints.map(t => <ValueRow key={t.id} name={t.name} value={t.value} extra={t.query} enabled={t.enabled} copyText={`/* ${t.name}: ${t.value} — ${t.query} */`} onName={n => updateBreak(t.id, { name: n })} onToggle={() => updateBreak(t.id, { enabled: !t.enabled })} />)
        )}
      </div>

      <ExportBar tokens={tokens} />
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <span className="text-xs" style={{ color: S.sub }}>{label}</span>
    </div>
  )
}
