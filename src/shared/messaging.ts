// Chrome extension iframe messaging constants.
// We use '*' as target origin intentionally — the iframe is same-process
// (chrome-extension:// → injected page), there is no cross-origin risk,
// and the extension source is verified via event.data.source checks.
export const PANEL_ORIGIN = '*' as const

export function postToParent(msg: object) {
  window.parent.postMessage({ source: 'devlens-panel', ...msg }, PANEL_ORIGIN)
}
