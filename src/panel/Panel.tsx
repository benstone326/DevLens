import React, { useEffect, useState } from 'react'
import { X, Search, Palette, Monitor, Camera, FolderOpen, Bug, Pipette, HelpCircle, Settings, Zap } from 'lucide-react'
import InspectorPanel from '../tools/inspector/InspectorPanel'
import EyedropperPanel from '../tools/eyedropper/EyedropperPanel'
import TokensPanel from '../tools/tokens/TokensPanel'
import { postToParent } from '../shared/messaging'
import { useHover } from '../shared/hooks'
import type { InspectorElementData } from '../tools/inspector/index'

// ─── Types ────────────────────────────────────────────────────────────────────
type Tool = 'inspector' | 'eyedropper' | 'tokens' | 'responsive' | 'screenshot' | 'assets' | 'debug'

interface NavItem {
  id:    Tool
  label: string
  icon:  React.ReactNode
  color: string
}

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  { id: 'inspector',  label: 'Inspector',    icon: <Search     size={16} />, color: '#6366f1' },
  { id: 'eyedropper', label: 'Color Picker', icon: <Palette    size={16} />, color: '#ef4444' },
  { id: 'tokens',     label: 'Tokens',       icon: <Pipette    size={16} />, color: '#10b981' },
  { id: 'responsive', label: 'Responsive',   icon: <Monitor    size={16} />, color: '#f59e0b' },
  { id: 'screenshot', label: 'Screenshot',   icon: <Camera     size={16} />, color: '#3b82f6' },
  { id: 'assets',     label: 'Assets',       icon: <FolderOpen size={16} />, color: '#8b5cf6' },
  { id: 'debug',      label: 'Debug',        icon: <Bug        size={16} />, color: '#ec4899' },
]

// ─── Placeholder ──────────────────────────────────────────────────────────────
function PlaceholderTool({ item }: { item: NavItem }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
           style={{ background: `${item.color}22` }}>
        <Zap size={24} style={{ color: item.color }} />
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: '#111827' }}>{item.label}</p>
        <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#6b7280' }}>
          Coming in a future phase
        </p>
      </div>
      <div className="text-xs px-3 py-1.5 rounded-full font-medium"
           style={{ background: `${item.color}18`, color: item.color }}>
        Coming soon →
      </div>
    </div>
  )
}

// ─── NavButton ────────────────────────────────────────────────────────────────
// Active:   tool color at 10% bg opacity + left 2×16px indicator bar
// Hover:    tool color at 10% bg opacity, no indicator
// Inactive: transparent bg, icon #9ca3af
function NavButton({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick: () => void }) {
  const [hovered, hoverProps] = useHover()
  const showBg = isActive || hovered
  return (
    <button
      onClick={onClick}
      title={item.label}
      {...hoverProps}
      style={{
        position:       'relative',
        width:          36,
        height:         36,
        borderRadius:   12,
        border:         'none',
        flexShrink:     0,
        background:     showBg ? `${item.color}1a` : 'transparent',
        color:          showBg ? item.color : '#9ca3af',
        transition:     'background 0.12s, color 0.12s',
        cursor:         'pointer',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}
    >
      {item.icon}
      {/* Left indicator — active only */}
      {isActive && (
        <div style={{
          position:     'absolute',
          left:         0,
          top:          '50%',
          transform:    'translateY(-50%)',
          width:        2,
          height:       16,
          background:   item.color,
          borderRadius: '0 999px 999px 0',
        }} />
      )}
      {/* Tooltip */}
      <div style={{
        position:       'absolute',
        left:           'calc(100% + 8px)',
        top:            '50%',
        transform:      'translateY(-50%)',
        padding:        '4px 8px',
        borderRadius:   6,
        fontSize:       11,
        fontWeight:     500,
        whiteSpace:     'nowrap',
        background:     '#111827',
        color:          '#f9fafb',
        border:         '1px solid #374151',
        boxShadow:      '0 4px 12px rgba(0,0,0,0.15)',
        pointerEvents:  'none',
        zIndex:         100,
        opacity:        hovered ? 1 : 0,
        transition:     'opacity 0.12s',
      }}>
        {item.label}
        <div style={{
          position:    'absolute',
          right:       '100%',
          top:         '50%',
          transform:   'translateY(-50%)',
          borderWidth: 4,
          borderStyle: 'solid',
          borderColor: 'transparent #111827 transparent transparent',
        }} />
      </div>
    </button>
  )
}

// ─── UtilButton ───────────────────────────────────────────────────────────────
// Close / Settings / Help — 36×36, gray-100 hover bg, no indicator
function UtilButton({
  icon, title, onClick, onMouseDown, hoverColor, active,
}: {
  icon:         React.ReactNode
  title:        string
  onClick?:     () => void
  onMouseDown?: (e: React.MouseEvent) => void
  hoverColor?:  string
  active?:      boolean
}) {
  const [hovered, hoverProps] = useHover()
  const showBg = hovered || active
  return (
    <button
      onClick={onClick}
      onMouseDown={onMouseDown}
      title={title}
      {...hoverProps}
      style={{
        width:          36,
        height:         36,
        borderRadius:   12,
        border:         'none',
        flexShrink:     0,
        background:     showBg ? (hoverColor ? `${hoverColor}1a` : '#e5e7eb') : 'transparent',
        color:          showBg ? (hoverColor ?? '#374151') : '#9ca3af',
        transition:     'background 0.12s, color 0.12s',
        cursor:         onMouseDown ? 'grab' : 'pointer',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}
    >
      {icon}
    </button>
  )
}

// ─── Drag/Magnet button ────────────────────────────────────────────────────────
// Snapped:  6-dot grip → mousedown to drag
// Floating: magnet icon → click = snap back, hold+drag = drag again
function DragOrMagnetButton({
  isFloating, onMouseDown, onSnapBack,
}: {
  isFloating:  boolean
  onMouseDown: (e: React.MouseEvent) => void
  onSnapBack:  () => void
}) {
  const [hovered, hoverProps] = useHover()

  // 6-dot grip — matches Figma DragVertical (2 columns × 3 rows)
  const GripIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="5.5" cy="4"  r="1.2" fill="currentColor" />
      <circle cx="5.5" cy="8"  r="1.2" fill="currentColor" />
      <circle cx="5.5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="10.5" cy="4"  r="1.2" fill="currentColor" />
      <circle cx="10.5" cy="8"  r="1.2" fill="currentColor" />
      <circle cx="10.5" cy="12" r="1.2" fill="currentColor" />
    </svg>
  )

  // Horseshoe magnet — matches Figma 19:740: U-shape with two prong ends, single color
  const MagnetIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      {/* Single path: two legs + arch, drawn as a U shape */}
      <path
        d="M3.5 12.5V6.5a4.5 4.5 0 019 0v6"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="square"
        fill="none"
      />
      {/* Left prong cap */}
      <line x1="2.1" y1="12.5" x2="4.9" y2="12.5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="square"/>
      {/* Right prong cap */}
      <line x1="11.1" y1="12.5" x2="13.9" y2="12.5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="square"/>
    </svg>
  )

  if (isFloating) {
    // Magnet button when floating.
    // We can't reliably detect drag vs click inside the iframe because once
    // pointer-events are disabled on the iframe during drag, window-level
    // mousemove/mouseup listeners in the iframe context stop firing.
    // Solution: always send DRAG_START on mousedown so the content script
    // (which lives on the PAGE) owns the drag. If the mouse never moves more
    // than 4px before mouseup, the content script sends SNAP_BACK instead.
    return (
      <button
        onMouseDown={e => { e.preventDefault(); onMouseDown(e) }}
        title="Drag to move · Release without moving to snap back"
        {...hoverProps}
        style={{
          width:          36,
          height:         36,
          borderRadius:   12,
          border:         'none',
          flexShrink:     0,
          background:     hovered ? 'rgba(245,158,11,0.1)' : 'transparent',
          color:          hovered ? '#f59e0b' : '#9ca3af',
          transition:     'background 0.12s, color 0.12s',
          cursor:         'grab',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        }}
      >
        {MagnetIcon}
      </button>
    )
  }

  // Snapped — grip, drag to float
  return (
    <button
      onMouseDown={onMouseDown}
      title="Drag to detach"
      {...hoverProps}
      style={{
        width:          36,
        height:         36,
        borderRadius:   12,
        border:         'none',
        flexShrink:     0,
        background:     hovered ? '#e5e7eb' : 'transparent',
        color:          hovered ? '#374151' : '#9ca3af',
        transition:     'background 0.12s, color 0.12s',
        cursor:         'grab',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}
    >
      {GripIcon}
    </button>
  )
}

// ─── NavDivider ───────────────────────────────────────────────────────────────
const NavDivider = () => (
  <div style={{
    width:      24,
    height:     1,
    background: '#e5e7eb',
    flexShrink: 0,
    margin:     '2px 0',
  }} />
)

// ─── Root Panel ───────────────────────────────────────────────────────────────
export default function Panel() {
  const [activeTool, setActiveTool]           = useState<Tool>('inspector')
  const [inspectorActive, setInspectorActive] = useState(false)
  const [inspectorData, setInspectorData]     = useState<InspectorElementData | null>(null)
  const [isFloating, setIsFloating]           = useState(false)

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'ACTIVATE_TOOL' && event.data.tool)
        setActiveTool(event.data.tool as Tool)
      if (event.data?.type === 'INSPECTOR_DATA')
        setInspectorData(event.data.payload)
      if (event.data?.type === 'INSPECTOR_STOPPED') {
        setInspectorActive(false)
        setInspectorData(null)
      }
      if (event.data?.type === 'PANEL_FLOATING')
        setIsFloating(!!event.data.floating)
    }
    window.addEventListener('message', handleMessage)
    postToParent({ type: 'PANEL_READY' })
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  useEffect(() => {
    if (activeTool === 'inspector') {
      postToParent({ type: 'START_INSPECTOR' })
      setInspectorActive(true)
    } else if (inspectorActive) {
      postToParent({ type: 'STOP_INSPECTOR' })
      setInspectorActive(false)
    }
  }, [activeTool, inspectorActive])

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

  function onSnapBack() {
    postToParent({ type: 'SNAP_BACK' })
  }

  function renderTool() {
    const activeItem = NAV_ITEMS.find(n => n.id === activeTool) ?? NAV_ITEMS[0]
    switch (activeTool) {
      case 'inspector':  return <InspectorPanel data={inspectorData} _isActive={inspectorActive} />
      case 'eyedropper': return <EyedropperPanel />
      case 'tokens':     return <TokensPanel />
      default:           return <PlaceholderTool item={activeItem} />
    }
  }

  return (
    <div style={{
      display:    'flex',
      height:     '100%',
      width:      '100%',
      overflow:   'hidden',
      background: '#f9fafb', // gray-50 — content area bg bleeds through
    }}>

      {/* ── Sidebar ── */}
      {/* Spec: 52px wide, padding 12px 0 (top/bottom only, no horizontal),
               gap 4px, bg #f3f4f6 (gray-100), right border 1px #e5e7eb         */}
      <nav style={{
        width:          52,
        flexShrink:     0,
        background:     '#f3f4f6',
        borderRight:    '1px solid #e5e7eb',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        paddingTop:     12,
        paddingBottom:  12,
        gap:            4,
      }}>

        {/* ① Close */}
        <UtilButton
          icon={<X size={16} />}
          title="Close DevLens"
          onClick={closePanel}
          hoverColor="#ef4444"
        />

        {/* ② Drag (snapped) / Magnet (floating) */}
        <DragOrMagnetButton
          isFloating={isFloating}
          onMouseDown={onDragHandleMouseDown}
          onSnapBack={onSnapBack}
        />

        {/* Separator */}
        <NavDivider />

        {/* ③–⑨ Tool buttons */}
        {NAV_ITEMS.map(item => (
          <NavButton
            key={item.id}
            item={item}
            isActive={activeTool === item.id}
            onClick={() => setActiveTool(item.id)}
          />
        ))}

        {/* Push to bottom */}
        <div style={{ flex: 1 }} />

        {/* Separator */}
        <NavDivider />

        {/* ⑩ Settings */}
        <UtilButton
          icon={<Settings size={16} />}
          title="Settings"
        />

        {/* ⑪ Help */}
        <UtilButton
          icon={<HelpCircle size={16} />}
          title="Help"
        />

      </nav>

      {/* ── Content area ── */}
      {/* Spec: bg #f9fafb (gray-50) */}
      <div style={{
        flex:           1,
        minWidth:       0,
        display:        'flex',
        flexDirection:  'column',
        background:     '#f9fafb',
        overflow:       'hidden',
      }}>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {renderTool()}
        </div>
      </div>

    </div>
  )
}
