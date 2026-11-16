import { GROUP_COLORS, type GroupColor } from './types.ts'

type Tab = chrome.tabs.Tab

/** The `groupId` Chrome gives a tab that is in no group. */
export const NO_GROUP = chrome.tabGroups?.TAB_GROUP_ID_NONE ?? -1

/** Tab groups only exist in normal windows, not popups or app windows. */
export async function normalWindowIds(): Promise<Set<number>> {
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] })
  return new Set(windows.map((w) => w.id).filter((id): id is number => id !== undefined))
}

/** Focuses a tab wherever it lives, pulling its window forward if need be. */
export async function focusTab(tab: Tab): Promise<void> {
  if (tab.id === undefined) return
  await chrome.tabs.update(tab.id, { active: true })
  await chrome.windows.update(tab.windowId, { focused: true })
}

/**
 * One list of every tab, current window first. `searchTabs` breaks score ties
 * on this order, so the tab in front of you beats an identical one elsewhere.
 */
export async function snapshotTabs(): Promise<Tab[]> {
  const [current, all] = await Promise.all([
    chrome.tabs.query({ currentWindow: true }),
    chrome.tabs.query({}),
  ])
  const seen = new Set(current.map((tab) => tab.id))
  return [...current, ...all.filter((tab) => !seen.has(tab.id))]
}

/** Where a tab sits in Chrome right now — the badge on a result row. */
export interface OpenGroup {
  title: string
  color: GroupColor
}

/** Chrome types the colour loosely; narrow it before it reaches `ColorDot`. */
const pickColor = (color: string): GroupColor =>
  GROUP_COLORS.includes(color as GroupColor) ? (color as GroupColor) : 'grey'

export async function snapshotGroups(): Promise<Map<number, OpenGroup>> {
  const groups = await chrome.tabGroups.query({})
  return new Map(
    groups.map((group) => [group.id, { title: group.title ?? '', color: pickColor(group.color) }]),
  )
}

/** Chrome's own new tab page, or this extension's replacement for it. */
export function isNewTabPage(tab: Pick<Tab, 'url' | 'pendingUrl'>): boolean {
  const ours = chrome.runtime.getURL('newtab/')
  return [tab.url, tab.pendingUrl].some(
    (url) => url !== undefined && (url.startsWith(ours) || /^chrome(-search)?:\/\/(newtab|local-ntp)/.test(url)),
  )
}
