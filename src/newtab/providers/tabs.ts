import { hostOf } from '../../lib/matching.ts'
import { searchTabs } from '../../lib/search.ts'
import { NO_GROUP, focusTab, isNewTabPage, snapshotGroups, snapshotTabs, type OpenGroup } from '../../lib/tabs.ts'
import type { Provider, Result } from '../../lib/universal.ts'

type Tab = chrome.tabs.Tab

const MAX_RESULTS = 30

interface Snapshot {
  tabs: Tab[]
  groups: Map<number, OpenGroup>
  /** The new tab page the user is looking at, which is closed after a jump. */
  self: Tab | undefined
}

/**
 * One snapshot per visit, not per keystroke: re-querying while the user types
 * would reshuffle results as pages finish loading and retitle themselves.
 */
let snapshot: Promise<Snapshot> | null = null

async function take(): Promise<Snapshot> {
  const [tabs, groups, self] = await Promise.all([snapshotTabs(), snapshotGroups(), chrome.tabs.getCurrent()])
  // New tab pages are noise in a list of places to go, this one included.
  return { tabs: tabs.filter((tab) => !isNewTabPage(tab)), groups, self }
}

const load = () => (snapshot ??= take())

function toResult(tab: Tab, { groups, self }: Snapshot): Result {
  const host = hostOf(tab.url ?? '')
  const group = tab.groupId !== NO_GROUP ? groups.get(tab.groupId) : undefined

  return {
    id: `tab:${tab.id}`,
    kind: 'tab',
    title: tab.title || host || tab.url || 'Untitled',
    subtitle: host || tab.url,
    icon: tab.favIconUrl,
    badge: group?.title ? { label: group.title, color: group.color } : undefined,
    async activate() {
      await focusTab(tab)
      // Nobody wants the blank page they jumped away from left behind. Closing it
      // last means the target is already in front, so Chrome never picks a neighbour.
      if (self?.id !== undefined) await chrome.tabs.remove(self.id).catch(() => {})
    },
  }
}

export const tabsProvider: Provider = {
  id: 'tabs',
  trigger: '/tab',
  label: 'Open tabs',
  hint: 'Find a tab you already have open',

  async search(query) {
    const state = await load()
    // With nothing typed yet, list everything: `/tab` then arrow keys is a tab switcher.
    const hits = query.trim() ? searchTabs(state.tabs, query) : state.tabs
    return hits.slice(0, MAX_RESULTS).map((tab) => toResult(tab, state))
  },

  refresh() {
    snapshot = null
    void load()
  },
}
