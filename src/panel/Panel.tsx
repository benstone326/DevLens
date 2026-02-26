import React, { useEffect, useState } from 'react'
import { Search, Palette, Monitor, Camera, FolderOpen, Bug, X, Zap, GripHorizontal, PanelRight, Pipette } from 'lucide-react'
import InspectorPanel  from '../tools/inspector/InspectorPanel'
import EyedropperPanel from '../tools/eyedropper/EyedropperPanel'
import TokensPanel     from '../tools/tokens/TokensPanel'
import { S }           from '../shared/theme'
import { postToParent } from '../shared/messaging'
import { useHover }    from '../shared/hooks'
import type { InspectorElementData } from '../tools/inspector/index'

// ─── Types ────────────────────────────────────────────────────────────────────
type Tool = 'inspector' | 'eyedropper' | 'tokens' | 'responsive' | 'screenshot' | 'assets' | 'debug'

interface NavItem {
  id:    Tool
  label: string
  icon:  React.ReactNode
  color: string
  phase: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'inspector',  label: 'Inspector',  icon: <Search     size={15} />, color: '#6366f1', phase: ''        },
  { id: 'eyedropper', label: 'Eyedropper', icon: <Palette    size={15} />, color: '#f43f5e', phase: ''        },
  { id: 'tokens',     label: 'Tokens',     icon: <Pipette    size={15} />, color: '#10b981', phase: ''        },
  { id: 'responsive', label: 'Responsive', icon: <Monitor    size={15} />, color: '#f59e0b', phase: 'Phase 5' },
  { id: 'screenshot', label: 'Screenshot', icon: <Camera     size={15} />, color: '#3b82f6', phase: 'Phase 6' },
  { id: 'assets',     label: 'Assets',     icon: <FolderOpen size={15} />, color: '#8b5cf6', phase: 'Phase 4' },
  { id: 'debug',      label: 'Debug',      icon: <Bug        size={15} />, color: '#ec4899', phase: 'Phase 7' },
]

// ─── PlaceholderTool ──────────────────────────────────────────────────────────
// Receives the full NavItem — label for display, phase for copy, color for styling.
// Previously received tool id string and looked up phase via a separate map,
// which broke after PlaceholderTool was changed to receive label instead of id.
function PlaceholderTool({ item }: { item: NavItem }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
           style={{ background: `${item.color}22` }}>
        <Zap size={24} style={{ color: item.color }} />
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: S.text }}>{item.label}</p>
        <p className="text-xs mt-1.5 leading-relaxed" style={{ color: S.sub }}>
          Coming in {item.phase || 'a future phase'}
        </p>
      </div>
      <div className="text-xs px-3 py-1.5 rounded-full font-medium"
           style={{ background: `${item.color}18`, color: item.color }}>
        Coming soon →
      </div>
    </div>
  )
}

// ─── DragHandle ───────────────────────────────────────────────────────────────
// Isolated so useHover state doesn't trigger re-renders on the whole nav.
function DragHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  const [hovered, hoverProps] = useHover()
  return (
    <div
      onMouseDown={onMouseDown}
      title="Drag to move"
      className="flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0"
      style={{ width: 36, height: 36, borderRadius: 12, color: hovered ? '#6366f1' : '#aaaaaa', transition: 'color 0.15s' }}
      {...hoverProps}
    >
      <GripHorizontal size={14} />
    </div>
  )
}

// ─── SnapButton ───────────────────────────────────────────────────────────────
function SnapButton({ onClick }: { onClick: () => void }) {
  const [hovered, hoverProps] = useHover()
  return (
    <button
      onClick={onClick}
      title="Snap back to side"
      className="flex items-center justify-center shrink-0"
      style={{ width: 36, height: 36, borderRadius: 12, color: hovered ? '#10b981' : '#aaaaaa', border: 'none', transition: 'color 0.15s' }}
      {...hoverProps}
    >
      <PanelRight size={14} />
    </button>
  )
}

// ─── CloseButton ──────────────────────────────────────────────────────────────
function CloseButton({ onClick }: { onClick: () => void }) {
  const [hovered, hoverProps] = useHover()
  return (
    <button
      onClick={onClick}
      title="Close DevLens"
      className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center"
      style={{
        color:      hovered ? '#f43f5e' : S.sub,
        background: hovered ? '#f43f5e18' : 'transparent',
        transition: 'color 0.15s, background 0.15s',
      }}
      {...hoverProps}
    >
      <X size={14} />
    </button>
  )
}

// ─── NavButton ────────────────────────────────────────────────────────────────
// Isolated per-button so each hover state is independent.
function NavButton({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick: () => void }) {
  const [hovered, hoverProps] = useHover()
  return (
    <button
      onClick={onClick}
      title={item.label}
      className="relative flex items-center justify-center shrink-0 group"
      style={{
        width: 36, height: 36, borderRadius: 12, border: 'none',
        background: isActive ? `${item.color}1a` : hovered ? `${item.color}0d` : 'transparent',
        color:      isActive ? item.color : hovered ? item.color : '#aaaaaa',
        transition: 'background 0.15s, color 0.15s',
      }}
      {...hoverProps}
    >
      {item.icon}

      {/* Active indicator: 2×16 pill flush to left edge */}
      {isActive && (
        <div className="absolute" style={{
          left: 0, top: '50%', transform: 'translateY(-50%)',
          width: 2, height: 16, background: item.color,
          borderRadius: '0 999px 999px 0',
        }} />
      )}

      {/* Tooltip */}
      <div
        className="absolute left-full ml-2 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap
                   opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
        style={{ background: S.bgDeep, color: S.text, border: `1px solid ${S.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
      >
        {item.label}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent"
             style={{ borderRightColor: S.bgDeep }} />
      </div>
    </button>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────
export default function Panel() {
  const [activeTool,      setActiveTool]      = useState<Tool>('inspector')
  const [inspectorActive, setInspectorActive] = useState(false)
  const [inspectorData,   setInspectorData]   = useState<InspectorElementData | null>(null)

  // Receive messages from content script
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const { type, tool, payload } = event.data ?? {}
      if (type === 'ACTIVATE_TOOL' && tool) setActiveTool(tool as Tool)
      if (type === 'INSPECTOR_DATA')         setInspectorData(payload)
      if (type === 'INSPECTOR_STOPPED')      { setInspectorActive(false); setInspectorData(null) }
    }
    window.addEventListener('message', handleMessage)
    postToParent({ type: 'PANEL_READY' })
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Auto start/stop inspector when switching tools
  useEffect(() => {
    if (activeTool === 'inspector') {
      postToParent({ type: 'START_INSPECTOR' })
      setInspectorActive(true)
    } else if (inspectorActive) {
      postToParent({ type: 'STOP_INSPECTOR' })
      setInspectorActive(false)
    }
  // inspectorActive intentionally omitted — we only react to tool changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool])

  function closePanel() {
    if (inspectorActive) postToParent({ type: 'STOP_INSPECTOR' })
    postToParent({ type: 'CLOSE_PANEL' })
  }

  function onDragHandleMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    postToParent({ type: 'DRAG_START', offsetX: e.clientX, offsetY: e.clientY })
    function onMouseUp() {
      postToParent({ type: 'DRAG_END' })
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mouseup', onMouseUp)
  }

  const activeItem = NAV_ITEMS.find(n => n.id === activeTool)!

  function renderTool() {
    switch (activeTool) {
      case 'inspector':  return <InspectorPanel data={inspectorData} isActive={inspectorActive} />
      case 'eyedropper': return <EyedropperPanel />
      case 'tokens':     return <TokensPanel />
      default:           return <PlaceholderTool item={activeItem} />
    }
  }

  return (
    <div className="flex h-full w-full overflow-hidden" style={{
      background: S.bg, borderRadius: '16px 0 0 16px',
      border: `1px solid ${S.border}`, boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
    }}>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <nav className="flex flex-col items-center shrink-0" style={{
        width: 52, background: '#ffffff', borderRight: '1px solid #bbbbbb',
        paddingTop: 12, paddingBottom: 12, gap: 4,
      }}>
        {/* Logo */}
        <div className="flex items-center justify-center shrink-0"
             style={{ width: 36, height: 36, borderRadius: 12, background: '#000000' }}>
          <Zap size={14} style={{ color: '#ffffff' }} />
        </div>

        <DragHandle onMouseDown={onDragHandleMouseDown} />

        {/* Separator */}
        <div style={{ width: 24, height: 1, background: '#bbbbbb', flexShrink: 0, margin: '4px 0' }} />

        {NAV_ITEMS.map(item => (
          <NavButton key={item.id} item={item} isActive={activeTool === item.id} onClick={() => setActiveTool(item.id)} />
        ))}

        <div style={{ flex: 1 }} />
        <SnapButton onClick={() => postToParent({ type: 'SNAP_BACK' })} />
      </nav>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2 px-4 py-3 shrink-0"
             style={{ borderBottom: `1px solid ${S.border}` }}>
          <div className="w-6 h-6 rounded-md flex items-center justify-center"
               style={{ background: `${activeItem.color}22`, color: activeItem.color }}>
            {activeItem.icon}
          </div>
          <span className="text-sm font-semibold" style={{ color: S.text }}>{activeItem.label}</span>
          {inspectorActive && activeTool === 'inspector' && (
            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full animate-pulse"
                  style={{ background: '#6366f122', color: '#818cf8' }}>
              live
            </span>
          )}
          <CloseButton onClick={closePanel} />
        </div>

        <div className="flex-1 overflow-y-auto">
          {renderTool()}
        </div>
      </div>
    </div>
  )
}
