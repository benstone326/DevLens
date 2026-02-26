import { startInspector, stopInspector, extractElementData, navigateLocked, setBoxMode } from '../tools/inspector/index'
import { extractTokens } from '../tools/tokens/index'

// Guard against double-injection
if ((window as any).__devlens_loaded) throw new Error('[DevLens] Already loaded')
;(window as any).__devlens_loaded = true

let isDragging = false
let dragOffsetX = 0
let dragOffsetY = 0
let isFloating = false
let panelReady = false
let pendingTool: string | null = null

const getContainer = (): HTMLDivElement | null =>
  document.getElementById('devlens-root') as HTMLDivElement | null

const getIframe = (): HTMLIFrameElement | null =>
  document.getElementById('devlens-iframe') as HTMLIFrameElement | null

const isPanelOpen = (): boolean => getContainer()?.dataset.open === 'true'
const setPanelOpen = (val: boolean) => { const c = getContainer(); if (c) c.dataset.open = String(val) }

// ─── Mount ────────────────────────────────────────────────────────────────────
function mountPanel() {
  if (getContainer()) return

  const container = document.createElement('div')
  container.id = 'devlens-root'
  container.dataset.open = 'false'
  container.style.cssText = `
    position:fixed;top:0;right:0;width:360px;height:100vh;
    z-index:2147483647;pointer-events:none;
  `

  const iframe = document.createElement('iframe')
  iframe.id = 'devlens-iframe'
  iframe.src = chrome.runtime.getURL('panel.html')
  iframe.style.cssText = `
    width:100%;height:100%;border:none;background:transparent;
    pointer-events:all;display:block;
    transform:translateX(110%);
    transition:transform 0.25s cubic-bezier(0.4,0,0.2,1);
    border-radius:16px 0 0 16px;
    box-shadow:-8px 0 32px rgba(0,0,0,0.3);
  `

  container.appendChild(iframe)
  document.documentElement.appendChild(container)
  ;(window as any).__devlens_iframe = iframe
  setupMessageBridge()
  setupDrag()
}

// ─── Open / Close ─────────────────────────────────────────────────────────────
function openPanel() {
  mountPanel()
  setPanelOpen(true)
  const iframe = getIframe()!
  iframe.style.transition = 'transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease'
  iframe.style.opacity = '1'
  iframe.style.transform = isFloating ? 'scale(1)' : 'translateX(0)'
  iframe.style.pointerEvents = 'all'
}

function closePanel() {
  stopInspector()
  const iframe = getIframe()
  if (!iframe) return
  setPanelOpen(false)
  iframe.style.pointerEvents = 'none'
  if (isFloating) {
    iframe.style.opacity = '0'
    iframe.style.transform = 'scale(0.95)'
  } else {
    iframe.style.transform = 'translateX(110%)'
  }
}

function togglePanel() {
  isPanelOpen() ? closePanel() : openPanel()
}

function snapBack() {
  const container = getContainer()
  const iframe = getIframe()
  if (!container || !iframe) return
  isFloating = false
  Object.assign(container.style, { left: '', top: '0', right: '0', height: '100vh', width: '360px' })
  iframe.style.transition = 'transform 0.25s cubic-bezier(0.4,0,0.2,1), border-radius 0.25s, box-shadow 0.25s'
  iframe.style.borderRadius = '16px 0 0 16px'
  iframe.style.boxShadow = '-8px 0 32px rgba(0,0,0,0.3)'
  iframe.style.transform = 'translateX(0)'
  iframe.style.opacity = '1'
  iframe.style.pointerEvents = 'all'
  setPanelOpen(true)
}

// ─── Message bridge ───────────────────────────────────────────────────────────
function postToPanel(msg: object) {
  getIframe()?.contentWindow?.postMessage(msg, '*')
}

function setupMessageBridge() {
  window.addEventListener('message', (event) => {
    if (event.data?.source !== 'devlens-panel') return
    const iframe = getIframe()

    switch (event.data.type) {
      case 'PANEL_READY':
        panelReady = true
        if (pendingTool) {
          postToPanel({ type: 'ACTIVATE_TOOL', tool: pendingTool })
          pendingTool = null
        }
        break

      case 'OPEN_URL': {
        // Try Google Fonts URL first, fall back to search if it 404s
        // We just open the GF URL directly — if the font isn't there the user lands on GF and can search
        window.open(event.data.url, '_blank')
        break
      }

      case 'NAVIGATE_TO': {
        const locked = (window as any).__devlens_locked_el as Element | null
        if (!locked) break
        let target: Element | null = null

        if (event.data.direction === 'ancestor') {
          let cur: Element | null = locked
          const steps = event.data.steps ?? 1
          for (let i = 0; i < steps; i++) {
            cur = cur?.parentElement ?? null
            if (!cur || cur === document.documentElement) { cur = null; break }
          }
          target = cur
        } else if (event.data.direction === 'child') {
          const children = Array.from(locked.children).filter(
            c => c.id !== 'devlens-root' && !c.id?.startsWith('devlens')
          )
          target = children[event.data.childIndex] ?? null
        }

        if (!target || target.closest('#devlens-root')) break
        ;(window as any).__devlens_locked_el = target
        ;(window as any).__devlens_original_styles = (target as HTMLElement).getAttribute('style') ?? ''
        navigateLocked(target)
        postToPanel({ type: 'INSPECTOR_DATA', payload: extractElementData(target) })
        break
      }

      case 'EXTRACT_TOKENS': {
        const tokenSet = extractTokens()
        postToPanel({ type: 'TOKENS_DATA', payload: tokenSet })
        break
      }

      case 'CLOSE_PANEL': closePanel(); break
      case 'SNAP_BACK': snapBack(); break

      case 'START_INSPECTOR':
        startInspector((data) => postToPanel({ type: 'INSPECTOR_DATA', payload: data }))
        break

      case 'STOP_INSPECTOR':
        stopInspector()
        ;(window as any).__devlens_locked_el = null
        ;(window as any).__devlens_original_styles = null
        postToPanel({ type: 'INSPECTOR_UNLOCKED' })
        break

      case 'SET_BOX_MODE': {
        setBoxMode(event.data.enabled as boolean)
        const el = (window as any).__devlens_locked_el as Element | null
        if (el) navigateLocked(el)
        break
      }

      case 'APPLY_OUTERHTML': {
        const el = (window as any).__devlens_locked_el as HTMLElement | null
        if (el && event.data.html) {
          try {
            const tmp = document.createElement('div')
            tmp.innerHTML = event.data.html
            const newEl = tmp.firstElementChild
            if (newEl) {
              el.replaceWith(newEl);
              (window as any).__devlens_locked_el = newEl
            }
          } catch { /* invalid html */ }
        }
        break
      }

      case 'APPLY_STYLE': {
        const el = (window as any).__devlens_locked_el as HTMLElement | null
        if (el && event.data.prop && event.data.value !== undefined)
          el.style.setProperty(event.data.prop, event.data.value)
        break
      }

      case 'RESET_STYLES': {
        const el = (window as any).__devlens_locked_el as HTMLElement | null
        if (el) {
          el.setAttribute('style', (window as any).__devlens_original_styles ?? '')
          ;(window as any).__devlens_original_styles = null
        }
        break
      }

      case 'DRAG_START': {
        isDragging = true
        const container = getContainer()!
        if (!isFloating) {
          Object.assign(container.style, {
            right: 'auto', left: `${window.innerWidth - 360}px`, top: '60px', height: '600px'
          })
          if (iframe) {
            iframe.style.borderRadius = '16px'
            iframe.style.boxShadow = '0 8px 48px rgba(0,0,0,0.4)'
          }
          isFloating = true
        }
        // Offset must be computed from the container's page position, not the
        // iframe-relative clientX/Y (which are only coincidentally correct when
        // the panel is snapped full-height to the right edge).
        const rect = container.getBoundingClientRect()
        dragOffsetX = (event.data.offsetX ?? 0) + rect.left
        dragOffsetY = (event.data.offsetY ?? 0) + rect.top
        if (iframe) iframe.style.pointerEvents = 'none'
        document.body.style.userSelect = 'none'
        break
      }

      case 'DRAG_END': stopDrag(); break
    }
  })
}

// ─── Drag ─────────────────────────────────────────────────────────────────────
function setupDrag() {
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return
    const container = getContainer()
    if (!container) return
    const newX = Math.max(0, Math.min(window.innerWidth - container.offsetWidth, e.clientX - dragOffsetX))
    const newY = Math.max(0, Math.min(window.innerHeight - container.offsetHeight, e.clientY - dragOffsetY))
    container.style.left = `${newX}px`
    container.style.top = `${newY}px`
  })
  document.addEventListener('mouseup', () => { if (isDragging) stopDrag() })
}

function stopDrag() {
  isDragging = false
  const iframe = getIframe()
  if (iframe) iframe.style.pointerEvents = 'all'
  document.body.style.userSelect = ''
}

// ─── Chrome message handler ───────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
  switch (message.type) {
    case 'PING':
      sendResponse({ type: 'PONG' })
      break

    case 'TOGGLE_PANEL':
      togglePanel()
      sendResponse({ isPanelOpen: isPanelOpen() })
      break

    case 'OPEN_TOOL': {
      const tool = message.payload?.tool
      openPanel()
      if (panelReady) {
        postToPanel({ type: 'ACTIVATE_TOOL', tool })
      } else {
        pendingTool = tool
      }
      sendResponse({ ok: true })
      break
    }
  }
  return true
})

document.addEventListener('keydown', (e) => {
  if (e.altKey && e.shiftKey && e.key === 'D') togglePanel()
})
