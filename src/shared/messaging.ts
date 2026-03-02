// Chrome extension iframe messaging constants.
// We avoid wildcard target origins and scope messages with a dedicated channel.
export const DEVLENS_CHANNEL = 'devlens-panel' as const

function getParentOrigin(): string {
  try {
    if (!document.referrer) return window.location.origin
    return new URL(document.referrer).origin
  } catch {
    return window.location.origin
  }
}

export function postToParent(msg: object) {
  window.parent.postMessage({ channel: DEVLENS_CHANNEL, ...msg }, getParentOrigin())
}
