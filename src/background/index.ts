// Background Service Worker — keyboard shortcuts + message routing

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return

  const ensureContentScript = async (tabId: number) => {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'PING' })
    } catch {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
      await new Promise(r => setTimeout(r, 80))
    }
  }

  if (command === 'toggle-panel') {
    await ensureContentScript(tab.id)
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' })
  } else if (command === 'toggle-inspector') {
    await ensureContentScript(tab.id)
    chrome.tabs.sendMessage(tab.id, { type: 'OPEN_TOOL', payload: { tool: 'inspector' } })
  } else if (command === 'toggle-eyedropper') {
    await ensureContentScript(tab.id)
    chrome.tabs.sendMessage(tab.id, { type: 'OPEN_TOOL', payload: { tool: 'eyedropper' } })
  }
})

chrome.runtime.onMessage.addListener((_message, _sender, sendResponse) => {
  sendResponse({ type: 'PONG' })
  return true
})
