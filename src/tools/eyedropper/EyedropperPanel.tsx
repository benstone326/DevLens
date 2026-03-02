import { copyToClipboard } from '../../shared/clipboard'
import React, { useState, useEffect } from 'react'
import { Pipette, Copy, Check, Trash2, X } from 'lucide-react'
import { S } from '../../shared/theme'
import { useHover } from '../../shared/hooks'

const STORAGE_KEY = 'devlens_picked_colors'

interface PickedColor { hex: string; rgb: string; hsl: string; id: string }

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6;               break
      case b: h = ((r - g) / d + 4) / 6;               break
    }
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { copyToClipboard(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="p-1 rounded-lg transition-all"
      style={{ color: copied ? '#10b981' : S.sub, background: copied ? '#10b98118' : 'transparent' }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

function ClearButton({ onClick }: { onClick: () => void }) {
  const [hovered, hoverProps] = useHover()
  return (
    <button
      onClick={onClick}
      title="Clear all"
      className="p-2 rounded-xl transition-colors"
      style={{ color: hovered ? '#f43f5e' : S.sub, background: S.surface, border: `1px solid ${S.border}` }}
      {...hoverProps}
    >
      <Trash2 size={13} />
    </button>
  )
}

export default function EyedropperPanel() {
  const [colors,    setColors]    = useState<PickedColor[]>([])
  const [isPicking, setIsPicking] = useState(false)
  const [activeId,  setActiveId]  = useState<string | null>(null)

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const saved = result[STORAGE_KEY] as PickedColor[] | undefined
      if (saved?.length) { setColors(saved); setActiveId(saved[0].id) }
    })
  }, [])

  useEffect(() => {
    chrome.storage.local.set({ [STORAGE_KEY]: colors })
  }, [colors])

  async function pickColor() {
    const eyeDropperCtor = (window as Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper
    if (!eyeDropperCtor) { alert('EyeDropper API not supported.'); return }
    setIsPicking(true)
    try {
      const result = await new eyeDropperCtor().open()
      const hex    = result.sRGBHex
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      const color: PickedColor = {
        hex: hex.toUpperCase(),
        rgb: `rgb(${r}, ${g}, ${b})`,
        hsl: hexToHsl(hex),
        id:  `${Date.now()}-${Math.random()}`,
      }
      setColors(prev => [color, ...prev.slice(0, 49)])
      setActiveId(color.id)
    } catch { /* user cancelled */ }
    setIsPicking(false)
  }

  function deleteColor(id: string) {
    setColors(prev => {
      const next = prev.filter(c => c.id !== id)
      if (id === activeId) setActiveId(next.length > 0 ? next[0].id : null)
      return next
    })
  }

  function clearAll() { setColors([]); setActiveId(null) }

  const activeColor = colors.find(c => c.id === activeId) ?? null

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2 flex gap-2">
        <button
          onClick={pickColor}
          disabled={isPicking}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: '#f43f5e18',
            color:      isPicking ? '#f43f5eaa' : '#f43f5e',
            border:    `1px solid ${isPicking ? '#f43f5e44' : '#f43f5e22'}`,
          }}
        >
          <Pipette size={13} />
          {isPicking ? 'Click anywhere...' : 'Pick Color'}
        </button>
        {colors.length > 0 && <ClearButton onClick={clearAll} />}
      </div>

      {colors.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 px-4 text-center">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f43f5e18' }}>
            <Pipette size={18} style={{ color: '#f43f5e' }} />
          </div>
          <p className="text-xs" style={{ color: S.sub }}>
            Click "Pick Color" then click<br />anywhere on the page
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-3">
          {activeColor && (
            <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
              <div className="h-16 w-full" style={{ background: activeColor.hex }} />
              <div className="p-3 flex flex-col gap-1.5" style={{ background: S.surface }}>
                {([
                  { label: 'HEX', value: activeColor.hex },
                  { label: 'RGB', value: activeColor.rgb },
                  { label: 'HSL', value: activeColor.hsl },
                ] as { label: string; value: string }[]).map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[10px] w-8" style={{ color: S.sub }}>{label}</span>
                    <span className="text-[11px] font-mono flex-1" style={{ color: '#6366f1' }}>{value}</span>
                    <CopyBtn text={value} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-[10px] mb-2" style={{ color: S.sub }}>
              SAVED — {colors.length} color{colors.length !== 1 ? 's' : ''}
            </div>
            <div className="flex flex-wrap gap-2">
              {colors.map(color => (
                <div key={color.id} className="relative group">
                  <button
                    onClick={() => setActiveId(color.id)}
                    title={color.hex}
                    className="w-9 h-9 rounded-xl transition-all"
                    style={{
                      background: color.hex,
                      border:    `2px solid ${color.id === activeId ? 'rgba(99,102,241,0.6)' : S.border}`,
                      boxShadow:  color.id === activeId ? '0 0 0 2px #6366f1' : '0 2px 8px rgba(0,0,0,0.15)',
                      transform:  color.id === activeId ? 'scale(1.1)' : 'scale(1)',
                    }}
                  />
                  <button
                    onClick={() => deleteColor(color.id)}
                    title="Remove"
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full items-center justify-center
                               opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:flex"
                    style={{ background: '#f43f5e', color: '#fff' }}
                  >
                    <X size={8} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
