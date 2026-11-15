/** Tab groups only exist in normal windows, not popups or app windows. */
export async function normalWindowIds(): Promise<Set<number>> {
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] })
  return new Set(windows.map((w) => w.id).filter((id): id is number => id !== undefined))
}

/** Focuses a tab wherever it lives, pulling its window forward if need be. */
export async function focusTab(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined) return
  await chrome.tabs.update(tab.id, { active: true })
  await chrome.windows.update(tab.windowId, { focused: true })
}
