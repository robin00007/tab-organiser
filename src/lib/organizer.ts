import { findGroupForTab, isOrganizable } from './matching.ts'
import type { Config, Group, OrganizeResult, Scope } from './types.ts'

const NO_GROUP = chrome.tabGroups?.TAB_GROUP_ID_NONE ?? -1

type Tab = chrome.tabs.Tab

/** `chrome.tabs.group` and `ungroup` want a non-empty tuple, not just an array. */
type NonEmpty<T> = [T, ...T[]]
const asNonEmpty = <T>(items: T[]): NonEmpty<T> | null =>
  items.length > 0 ? (items as NonEmpty<T>) : null

const groupKey = (name: string) => name.trim().toLowerCase()

/** Tab groups only exist in normal windows, not popups or app windows. */
async function normalWindowIds(): Promise<Set<number>> {
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] })
  return new Set(windows.map((w) => w.id).filter((id): id is number => id !== undefined))
}

/**
 * Chrome tab groups have no stable identity we could store, so a group is
 * matched to its config entry by title. That also means a group the user
 * renamed in Chrome simply stops being ours, which is the behaviour we want.
 */
async function titleIndex(windowId: number): Promise<Map<string, number>> {
  const groups = await chrome.tabGroups.query({ windowId })
  const index = new Map<string, number>()
  for (const group of groups) {
    const key = groupKey(group.title ?? '')
    if (key && !index.has(key)) index.set(key, group.id)
  }
  return index
}

async function collapseSafely(groupId: number, activeTabGroupIds: Set<number>): Promise<void> {
  // Chrome refuses to collapse a group that holds the active tab.
  if (activeTabGroupIds.has(groupId)) return
  try {
    await chrome.tabGroups.update(groupId, { collapsed: true })
  } catch {
    /* the group may have been closed while we worked */
  }
}

function eligible(tab: Tab, config: Config, windows: Set<number>): boolean {
  if (tab.id === undefined || tab.windowId === undefined) return false
  if (!windows.has(tab.windowId)) return false
  if (tab.pinned && !config.settings.includePinned) return false
  return isOrganizable(tab.url)
}

/**
 * Sorts tabs into one bucket per (window, group) pair so the whole sweep costs
 * one `tabs.group` call per bucket instead of one per tab.
 */
function bucketTabs(tabs: Tab[], config: Config, windows: Set<number>) {
  const buckets = new Map<string, { windowId: number; group: Group; tabIds: number[] }>()
  const unmatched: Tab[] = []

  for (const tab of tabs) {
    if (!eligible(tab, config, windows)) continue
    const group = findGroupForTab(config.groups, tab)
    if (!group) {
      unmatched.push(tab)
      continue
    }
    const key = `${tab.windowId}\u0000${group.id}`
    const bucket = buckets.get(key) ?? { windowId: tab.windowId, group, tabIds: [] }
    bucket.tabIds.push(tab.id as number)
    buckets.set(key, bucket)
  }

  return { buckets: [...buckets.values()], unmatched }
}

async function activeGroupIds(): Promise<Set<number>> {
  const active = await chrome.tabs.query({ active: true })
  return new Set(active.map((tab) => tab.groupId).filter((id) => id !== undefined && id !== NO_GROUP))
}

/** Puts every matching tab in scope into its group. This is "Organise now". */
export async function organizeAll(config: Config, scope?: Scope): Promise<OrganizeResult> {
  const effectiveScope = scope ?? config.settings.scope
  const [tabs, windows, activeGroups] = await Promise.all([
    chrome.tabs.query(effectiveScope === 'currentWindow' ? { currentWindow: true } : {}),
    normalWindowIds(),
    activeGroupIds(),
  ])

  const { buckets, unmatched } = bucketTabs(tabs, config, windows)
  const tabGroupIdOf = new Map(tabs.map((tab) => [tab.id, tab.groupId] as const))

  // One title lookup per window rather than per bucket.
  const indexes = new Map<number, Map<string, number>>()
  for (const { windowId } of buckets) {
    if (!indexes.has(windowId)) indexes.set(windowId, await titleIndex(windowId))
  }

  const result: OrganizeResult = { tabsMoved: 0, groupsTouched: 0, tabsUngrouped: 0 }
  const ourNames = new Set(config.groups.map((group) => groupKey(group.name)))

  for (const { windowId, group, tabIds } of buckets) {
    const index = indexes.get(windowId)
    const existingId = index?.get(groupKey(group.name))
    // Tabs already sitting in the right group need no move.
    const pending = asNonEmpty(tabIds.filter((id) => tabGroupIdOf.get(id) !== existingId))
    if (!pending) continue

    try {
      const chromeGroupId =
        existingId !== undefined
          ? await chrome.tabs.group({ tabIds: pending, groupId: existingId })
          : await chrome.tabs.group({ tabIds: pending, createProperties: { windowId } })

      index?.set(groupKey(group.name), chromeGroupId)
      await chrome.tabGroups.update(chromeGroupId, { title: group.name, color: group.color })
      if (group.collapse) await collapseSafely(chromeGroupId, activeGroups)

      result.tabsMoved += pending.length
      result.groupsTouched += 1
    } catch {
      /* a tab or window can vanish mid-sweep; the next sweep will catch it */
    }
  }

  if (config.settings.ungroupUnmatched) {
    const strays = asNonEmpty(await pickStrays(unmatched, ourNames))
    if (strays) {
      try {
        await chrome.tabs.ungroup(strays)
        result.tabsUngrouped = strays.length
      } catch {
        /* ignore */
      }
    }
  }

  return result
}

/** Tabs that match nothing but still sit in a group we manage. */
async function pickStrays(unmatched: Tab[], ourNames: Set<string>): Promise<number[]> {
  const grouped = unmatched.filter((tab) => tab.groupId !== undefined && tab.groupId !== NO_GROUP)
  if (grouped.length === 0) return []

  const titles = new Map<number, string>()
  for (const groupId of new Set(grouped.map((tab) => tab.groupId))) {
    try {
      const group = await chrome.tabGroups.get(groupId)
      titles.set(groupId, groupKey(group.title ?? ''))
    } catch {
      /* gone already */
    }
  }

  return grouped
    .filter((tab) => ourNames.has(titles.get(tab.groupId) ?? ''))
    .map((tab) => tab.id)
    .filter((id): id is number => id !== undefined)
}

/**
 * The auto-organise path for a single tab. It deliberately refuses to touch a
 * tab that the user placed in a group of their own — only ungrouped tabs and
 * tabs in groups we manage are fair game.
 */
export async function organizeTab(tabId: number, config: Config): Promise<boolean> {
  let tab: Tab
  try {
    tab = await chrome.tabs.get(tabId)
  } catch {
    return false
  }

  const windows = await normalWindowIds()
  if (!eligible(tab, config, windows)) return false

  const target = findGroupForTab(config.groups, tab)
  const currentGroupId = tab.groupId ?? NO_GROUP
  const isGrouped = currentGroupId !== NO_GROUP

  let currentTitle = ''
  if (isGrouped) {
    try {
      currentTitle = groupKey((await chrome.tabGroups.get(currentGroupId)).title ?? '')
    } catch {
      return false
    }
  }
  const ourNames = new Set(config.groups.map((group) => groupKey(group.name)))
  const inOurGroup = isGrouped && ourNames.has(currentTitle)

  if (!target) {
    if (inOurGroup && config.settings.ungroupUnmatched) {
      await chrome.tabs.ungroup(tabId).catch(() => {})
      return true
    }
    return false
  }

  if (isGrouped) {
    if (currentTitle === groupKey(target.name)) return false
    if (!inOurGroup || !config.settings.moveMismatched) return false
  }

  const index = await titleIndex(tab.windowId)
  const existingId = index.get(groupKey(target.name))

  try {
    const chromeGroupId =
      existingId !== undefined
        ? await chrome.tabs.group({ tabIds: tabId, groupId: existingId })
        : await chrome.tabs.group({ tabIds: tabId, createProperties: { windowId: tab.windowId } })

    if (existingId === undefined) {
      await chrome.tabGroups.update(chromeGroupId, { title: target.name, color: target.color })
      if (target.collapse) await collapseSafely(chromeGroupId, await activeGroupIds())
    }
    return true
  } catch {
    return false
  }
}

/** Dissolves every Chrome group whose title matches one of our groups. */
export async function ungroupManaged(config: Config, scope?: Scope): Promise<number> {
  const effectiveScope = scope ?? config.settings.scope
  const ourNames = new Set(config.groups.map((group) => groupKey(group.name)))
  const query = effectiveScope === 'currentWindow' ? { windowId: chrome.windows.WINDOW_ID_CURRENT } : {}
  const groups = await chrome.tabGroups.query(query)

  let count = 0
  for (const group of groups) {
    if (!ourNames.has(groupKey(group.title ?? ''))) continue
    const tabs = await chrome.tabs.query({ groupId: group.id })
    const ids = asNonEmpty(tabs.map((tab) => tab.id).filter((id): id is number => id !== undefined))
    if (!ids) continue
    try {
      await chrome.tabs.ungroup(ids)
      count += ids.length
    } catch {
      /* ignore */
    }
  }
  return count
}

export interface GroupPreview {
  groupId: string
  matching: number
}

export interface Summary {
  previews: GroupPreview[]
  unmatched: number
  total: number
}

/** What a sweep would do right now — used for the counts shown in the popup. */
export async function summarize(config: Config, scope?: Scope): Promise<Summary> {
  const effectiveScope = scope ?? config.settings.scope
  const [tabs, windows] = await Promise.all([
    chrome.tabs.query(effectiveScope === 'currentWindow' ? { currentWindow: true } : {}),
    normalWindowIds(),
  ])

  const counts = new Map<string, number>()
  let unmatched = 0
  let total = 0

  for (const tab of tabs) {
    if (!eligible(tab, config, windows)) continue
    total += 1
    const group = findGroupForTab(config.groups, tab)
    if (!group) {
      unmatched += 1
      continue
    }
    counts.set(group.id, (counts.get(group.id) ?? 0) + 1)
  }

  return {
    previews: config.groups.map((group) => ({ groupId: group.id, matching: counts.get(group.id) ?? 0 })),
    unmatched,
    total,
  }
}
