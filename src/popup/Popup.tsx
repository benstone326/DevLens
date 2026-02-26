import React from 'react'
import { Search, Palette, Monitor, Camera, FolderOpen, Bug, Zap } from 'lucide-react'

const TOOLS = [
  { id: 'inspector',  label: 'Inspector',        description: 'Hover to inspect HTML & CSS',  icon: <Search size={18} />,     color: '#6366f1' },
  { id: 'eyedropper', label: 'Color Eyedropper', description: 'Pick colors from anywhere',    icon: <Palette size={18} />,    color: '#f43f5e' },
  { id: 'responsive', label: 'Responsive',       description: 'Preview on multiple devices',  icon: <Monitor size={18} />,    color: '#10b981' },
  { id: 'screenshot', label: 'Screenshot',       description: 'Capture & edit screenshots',   icon: <Camera size={18} />,     color: '#f59e0b' },
  { id: 'assets',     label: 'Assets',           description: 'Extract images, SVGs, videos', icon: <FolderOpen size={18} />, color: '#3b82f6' },
  { id: 'debug',      label: 'Debug',            description: 'Clear cache, inject code',     icon: <Bug size={18} />,        color: '#8b5cf6' },
]

export default function Popup() {
  async function openTool(toolId: string) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return
    try { await chrome.tabs.sendMessage(tab.id, { type: 'PING' }) }
    catch {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
      await new Promise(r => setTimeout(r, 100))
    }
    await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_TOOL', payload: { tool: toolId } })
    window.close()
  }

  async function togglePanel() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return
    try { await chrome.tabs.sendMessage(tab.id, { type: 'PING' }) }
    catch {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
      await new Promise(r => setTimeout(r, 100))
    }
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' })
    window.close()
  }

  return (
    <div style={{ width: '300px', background: 'Canvas', color: 'CanvasText', colorScheme: 'light dark' }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: '1px solid color-mix(in srgb, ButtonBorder 35%, Canvas)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
             style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          <Zap size={13} style={{ color: '#fff' }} />
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: 'CanvasText' }}>DevLens</div>
          <div className="text-[10px]" style={{ color: 'GrayText' }}>Developer Tools</div>
        </div>
        <button onClick={togglePanel}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: '#6366f122', color: '#818cf8', border: '1px solid #6366f133' }}>
          Toggle Panel
        </button>
      </div>

      {/* Tool grid */}
      <div className="p-3 grid grid-cols-2 gap-2">
        {TOOLS.map(tool => (
          <button key={tool.id} onClick={() => openTool(tool.id)}
            className="flex flex-col gap-2 p-3 rounded-xl text-left transition-all"
            style={{ background: 'Field', border: '1px solid color-mix(in srgb, ButtonBorder 35%, Canvas)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${tool.color}55` }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'color-mix(in srgb, ButtonBorder 35%, Canvas)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                 style={{ background: `${tool.color}18`, color: tool.color }}>
              {tool.icon}
            </div>
            <div>
              <div className="text-xs font-semibold" style={{ color: 'CanvasText' }}>{tool.label}</div>
              <div className="text-[10px] mt-0.5 leading-tight" style={{ color: 'GrayText' }}>{tool.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
