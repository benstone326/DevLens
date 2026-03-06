import { startInspector, stopInspector, extractElementData, navigateLocked, setBoxMode } from '../tools/inspector/index'
import { extractTokens } from '../tools/tokens/index'

// Temporarily pause/resume inspector hover highlighting during drag
function setInspectorEnabled(enabled: boolean) {
  window.__devlens_inspector_enabled = enabled
}

// Guard against double-injection
if (window.__devlens_loaded) throw new Error('[DevLens] Already loaded')
window.__devlens_loaded = true

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
  window.__devlens_iframe = iframe
  setupMessageBridge()
  setupDrag()
}

// ─── Open / Close ─────────────────────────────────────────────────────────────
function openPanel() {
  mountPanel()
  setPanelOpen(true)
  const iframe = getIframe()
  if (!iframe) return
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
  if (isPanelOpen()) { closePanel() } else { openPanel() }
}

function snapBack() {
  const container = getContainer()
  const iframe = getIframe()
  if (!container || !iframe) return
  isFloating = false
  postToPanel({ type: 'PANEL_FLOATING', floating: false })
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
    // Security: verify message comes from our panel iframe.
    // Primary check: event.source matches the iframe's contentWindow.
    // Fallback: if iframe is not yet in DOM (e.g. early PANEL_READY), accept
    // messages that carry the devlens-panel source string — they can only
    // arrive from our extension's chrome-extension:// origin anyway.
    if (event.data?.source !== 'devlens-panel') return
    const iframe = getIframe()
    if (iframe && event.source !== iframe.contentWindow) return

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
        const locked = window.__devlens_locked_el
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
        } else if (event.data.direction === 'sibling') {
          const parent = locked.parentElement
          if (parent) {
            const siblings = (Array.from(parent.children) as Element[]).filter(
              (c: Element) => c.id !== 'devlens-root' && !c.id?.startsWith('devlens')
            )
            const idx = siblings.indexOf(locked)
            const next = idx + (event.data.delta ?? 0)
            if (next >= 0 && next < siblings.length) target = siblings[next]
          }
        }

        if (!target || target.closest('#devlens-root')) break
        window.__devlens_locked_el = target
        window.__devlens_original_styles = (target as HTMLElement).getAttribute('style') ?? ''
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
        window.__devlens_locked_el = null
        window.__devlens_original_styles = null
        // Clear any DevLens CSS suppressions
        ;(document.getElementById('devlens-disable-sheet') as HTMLStyleElement | null)?.remove()
        postToPanel({ type: 'INSPECTOR_UNLOCKED' })
        break

      // Design idea C: panel can lock/unlock element without a page click
      case 'LOCK_ELEMENT': {
        const el = window.__devlens_last_hovered
        if (el) {
          window.__devlens_locked_el = el
          window.__devlens_original_styles = (el as HTMLElement).getAttribute('style') ?? ''
          postToPanel({ type: 'INSPECTOR_LOCKED' })
        }
        break
      }

      case 'UNLOCK_ELEMENT': {
        // Remove all CSS suppressions before unlocking
        ;(document.getElementById('devlens-disable-sheet') as HTMLStyleElement | null)?.remove()
        const prevEl = window.__devlens_locked_el as HTMLElement | null
        if (prevEl) prevEl.removeAttribute('data-devlens-target')
        window.__devlens_locked_el = null
        window.__devlens_original_styles = null
        postToPanel({ type: 'INSPECTOR_UNLOCKED' })
        break
      }

      case 'SET_BOX_MODE': {
        setBoxMode(event.data.enabled as boolean)
        const el = window.__devlens_locked_el
        if (el) navigateLocked(el)
        break
      }

      case 'APPLY_OUTERHTML': {
        const el = window.__devlens_locked_el as HTMLElement | null
        if (el && event.data.html) {
          try {
            const tmp = document.createElement('div')
            tmp.innerHTML = event.data.html
            const newEl = tmp.firstElementChild
            if (newEl) {
              el.replaceWith(newEl)
              window.__devlens_locked_el = newEl
            }
          } catch { /* invalid html */ }
        }
        break
      }

      case 'APPLY_STYLE': {
        const el = window.__devlens_locked_el as HTMLElement | null
        if (!el || !event.data.prop) break
        const prop: string  = event.data.prop
        const value: string = event.data.value ?? ''
        // `restore` flag = true when re-enabling a toggled-off property.
        // In that case we remove the suppression rule and remove any inline
        // override so the cascade naturally restores the original sheet value.
        // We do NOT call setProperty — that would pollute element.style.
        const restore: boolean = !!event.data.restore

        const getSheet = (): HTMLStyleElement => {
          let sheet = document.getElementById('devlens-disable-sheet') as HTMLStyleElement | null
          if (!sheet) {
            sheet = document.createElement('style')
            sheet.id = 'devlens-disable-sheet'
            document.head.appendChild(sheet)
          }
          return sheet
        }

        const removeRule = (p: string) => {
          const sheet = document.getElementById('devlens-disable-sheet') as HTMLStyleElement | null
          if (!sheet) return
          // Escape hyphens for regex and remove the marker+rule line
          const escaped = p.replace(/-/g, '\\-')
          sheet.textContent = (sheet.textContent ?? '')
            .replace(new RegExp(`/\\*dl:${escaped}\\*/[^\\n]*\\n?`, 'g'), '')
        }

        if (value === '') {
          // ── DISABLE ──────────────────────────────────────────────────────────
          // Inject `[data-devlens-target] { prop: unset !important }` to beat
          // the page cascade. Removing inline style alone is not enough.
          el.setAttribute('data-devlens-target', '')
          const sheet = getSheet()
          // Remove stale rule for this prop first, then append fresh one
          removeRule(prop)
          const rule = `/*dl:${prop}*/[data-devlens-target]{${prop}:unset!important}\n`
          sheet.textContent = (sheet.textContent ?? '') + rule
          // Remove inline override so the sheet rule wins cleanly
          el.style.removeProperty(prop)
        } else if (restore) {
          // ── RE-ENABLE (restore to original cascade value) ─────────────────
          // Just remove the suppression rule — the browser cascade takes over.
          // Do NOT touch el.style so element.style stays clean.
          removeRule(prop)
          // Also clean up any stale inline value for this prop
          el.style.removeProperty(prop)
        } else {
          // ── EDIT (user changed the value) ─────────────────────────────────
          // Remove any suppression rule (shouldn't exist, but be safe), then
          // apply the new value inline so it overrides the sheet.
          removeRule(prop)
          el.style.setProperty(prop, value)
        }
        break
      }

      case 'RESET_STYLES': {
        const el = window.__devlens_locked_el as HTMLElement | null
        if (el) {
          // Remove all DevLens stylesheet suppressions
          const sheet = document.getElementById('devlens-disable-sheet') as HTMLStyleElement | null
          if (sheet) sheet.textContent = ''
          el.removeAttribute('data-devlens-target')
          el.setAttribute('style', window.__devlens_original_styles ?? '')
          window.__devlens_original_styles = null
        }
        break
      }

      case 'DRAG_START': {
        isDragging = true
        // Disable inspector highlighting while dragging
        setInspectorEnabled(false)
        const container = getContainer()
        if (!container) break
        const rect = container.getBoundingClientRect()
        // offsetX/Y = mouse position inside the iframe (iframe-local coords).
        // Since the iframe fills the container 1:1, these are exactly how far
        // the cursor is from the container's top-left corner.
        // Using them as dragOffset directly keeps whatever spot the user grabbed
        // pinned under the cursor throughout the drag — both on first snap and
        // while already floating.
        dragOffsetX = event.data.offsetX ?? 0
        dragOffsetY = event.data.offsetY ?? 0

        if (!isFloating) {
          // Place the floating container so the grab point stays under the cursor:
          //   containerLeft = mousePageX - dragOffsetX
          const mousePageX = rect.left + dragOffsetX
          const mousePageY = rect.top  + dragOffsetY
          const floatLeft = Math.max(0, Math.min(window.innerWidth  - 360, mousePageX - dragOffsetX))
          const floatTop  = Math.max(0, Math.min(window.innerHeight - 600, mousePageY - dragOffsetY))
          Object.assign(container.style, {
            right:  'auto',
            left:   `${floatLeft}px`,
            top:    `${floatTop}px`,
            height: '600px',
          })
          if (iframe) {
            iframe.style.borderRadius = '16px'
            iframe.style.boxShadow = '0 8px 48px rgba(0,0,0,0.4)'
          }
          isFloating = true
          postToPanel({ type: 'PANEL_FLOATING', floating: true })
        }
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
  setInspectorEnabled(true)
  const iframe = getIframe()
  if (iframe) iframe.style.pointerEvents = 'all'
  document.body.style.userSelect = ''
}

// ─── Chrome message handler ───────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message: Record<string, unknown>, _sender, sendResponse) => {
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
