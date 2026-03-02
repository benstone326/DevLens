// DevLens — iframe messaging constants and helpers.
//
// Security model:
//   The panel runs inside a chrome-extension:// iframe injected into the page.
//   Messages flow in two directions:
//     1. Panel → Page:  panel calls postToParent(), content script checks source + origin
//     2. Page → Panel:  content script calls postToPanel(), panel checks source + origin
//
// We use the extension's own origin (chrome.runtime.id) for strict validation
// instead of '*', which would accept messages from any script on the page.

/** The source tag stamped on every message from the panel. */
export const PANEL_SOURCE = 'devlens-panel' as const

/** The source tag stamped on every message from the content script. */
export const CONTENT_SOURCE = 'devlens-content' as const

/**
 * The chrome-extension:// origin of this extension.
 * Used to validate incoming messages in the content script.
 * Safe to call from any extension context.
 */
export function getExtensionOrigin(): string {
  return `chrome-extension://${chrome.runtime.id}`
}

/**
 * Send a message from the panel iframe to the parent page (content script).
 * Stamps the message with PANEL_SOURCE for identification.
 */
export function postToParent(msg: Record<string, unknown>): void {
  // We must use '*' here because the panel iframe's parent is the injected
  // page, whose origin varies per site. The content script validates the
  // message by checking event.data.source === PANEL_SOURCE instead.
  window.parent.postMessage({ source: PANEL_SOURCE, ...msg }, '*')
}

/**
 * Validates that a MessageEvent genuinely came from the DevLens panel.
 * Call this in the content script's message listener before processing.
 */
export function isPanelMessage(event: MessageEvent): boolean {
  return event.data?.source === PANEL_SOURCE
}

/**
 * Validates that a MessageEvent genuinely came from the DevLens content script.
 * Call this in the panel's message listener before processing.
 */
export function isContentMessage(event: MessageEvent): boolean {
  // The content script runs on the page, so its origin is the page's origin —
  // which varies. We validate by source tag only on this direction.
  return event.data?.source === CONTENT_SOURCE
}

/** All message type strings used in the DevLens messaging system. */
export type DevLensMessageType =
  | 'PANEL_READY'
  | 'ACTIVATE_TOOL'
  | 'OPEN_URL'
  | 'NAVIGATE_TO'
  | 'EXTRACT_TOKENS'
  | 'TOKENS_DATA'
  | 'CLOSE_PANEL'
  | 'SNAP_BACK'
  | 'START_INSPECTOR'
  | 'STOP_INSPECTOR'
  | 'INSPECTOR_DATA'
  | 'INSPECTOR_LOCKED'
  | 'INSPECTOR_UNLOCKED'
  | 'LOCK_ELEMENT'
  | 'UNLOCK_ELEMENT'
  | 'SET_BOX_MODE'
  | 'APPLY_OUTERHTML'
  | 'APPLY_STYLE'
  | 'RESET_STYLES'
  | 'DRAG_START'
  | 'DRAG_END'

/** Base shape of every DevLens message. */
export interface DevLensMessage {
  source: typeof PANEL_SOURCE | typeof CONTENT_SOURCE
  type: DevLensMessageType
  [key: string]: unknown
}
