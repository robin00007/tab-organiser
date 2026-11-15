import { findExistingTab } from './duplicates.ts'
import { focusTab, normalWindowIds } from './tabs.ts'

/**
 * If another tab already shows this tab's page, closes this one, brings the
 * other forward and reloads it, so opening a page twice lands on one fresh copy.
 * Returns whether a merge happened.
 *
 * Popups and app windows are left alone: a page that opened one may be waiting
 * on it (a sign-in window, say), and closing it would break that hand-off.
 */
export async function mergeIfDuplicate(tabId: number): Promise<boolean> {
  let tab: chrome.tabs.Tab
  try {
    tab = await chrome.tabs.get(tabId)
  } catch {
    return false
  }

  const windows = await normalWindowIds()
  if (!windows.has(tab.windowId)) return false

  const open = (await chrome.tabs.query({})).filter((other) => windows.has(other.windowId))
  const existing = findExistingTab(tab, open)
  if (existing?.id === undefined) return false

  try {
    // Reload first: it fails if the other tab has just been closed, and at that
    // point nothing has been lost yet. The new tab goes last, once the other
    // one is in front, so Chrome never has to pick a neighbour to show.
    await chrome.tabs.reload(existing.id)
    await focusTab(existing)
    await chrome.tabs.remove(tabId).catch(() => {})
    return true
  } catch {
    return false
  }
}
