// Chrome extension iframe messaging constants.
// We avoid wildcard target origins and scope messages with a dedicated channel.
export const DEVLENS_CHANNEL = 'devlens-panel' as const

function getParentOrigin(): string | null {
  try {
    const ancestorOrigin = window.location.ancestorOrigins?.[0]
    if (ancestorOrigin) return ancestorOrigin
    if (document.referrer) return new URL(document.referrer).origin
  } catch {
    // fall through to wildcard fallback
  }
  return null
}

export function postToParent(msg: object) {
  const targetOrigin = getParentOrigin() ?? '*'
  window.parent.postMessage({ channel: DEVLENS_CHANNEL, ...msg }, targetOrigin)
}
