/**
 * Copies text to clipboard in a way that works inside extension iframes.
 * navigator.clipboard.writeText() is blocked in cross-origin iframes even
 * with clipboardWrite permission — use the execCommand fallback instead.
 */
export function copyToClipboard(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
