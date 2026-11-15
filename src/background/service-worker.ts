import { ensureConfig, loadConfig, onConfigChanged } from '../lib/storage.ts'
import { duplicateKey } from '../lib/duplicates.ts'
import { hostOf } from '../lib/matching.ts'
import { mergeIfDuplicate } from '../lib/merge.ts'
import { organizeAll, organizeTab, summarize, ungroupManaged } from '../lib/organizer.ts'
import { searchTabs } from '../lib/search.ts'
import { focusTab } from '../lib/tabs.ts'
import type { Request } from '../lib/messages.ts'
import type { Config } from '../lib/types.ts'

/**
 * A service worker is torn down whenever Chrome feels like it, so the config is
 * a lazy cache: re-read on wake, refreshed in place while we stay alive.
 */
let cached: Config | null = null

const getConfig = async (): Promise<Config> => (cached ??= await loadConfig())

// Registered at the top level so the listener survives every worker restart.
onConfigChanged((config) => {
  cached = config
  void paintBadge(config)
})

async function paintBadge(config: Config): Promise<void> {
  const off = !config.settings.autoOrganize
  await chrome.action.setBadgeText({ text: off ? 'off' : '' })
  if (off) await chrome.action.setBadgeBackgroundColor({ color: '#71717a' })
}

/**
 * Navigation fires several events per tab; coalesce them so a single page load
 * results in one grouping decision.
 */
const DEBOUNCE_MS = 250
const pending = new Map<number, ReturnType<typeof setTimeout>>()

function schedule(tabId: number): void {
  const existing = pending.get(tabId)
  if (existing) clearTimeout(existing)
  pending.set(
    tabId,
    setTimeout(() => {
      pending.delete(tabId)
      void run(tabId)
    }, DEBOUNCE_MS),
  )
}

async function run(tabId: number): Promise<void> {
  const config = await getConfig()
  if (!config.settings.autoOrganize) return
  await organizeTab(tabId, config)
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const config = await ensureConfig()
  cached = config
  await paintBadge(config)
  // First install lands the user on the options page for onboarding.
  if (details.reason === 'install') await chrome.runtime.openOptionsPage()
})

chrome.runtime.onStartup.addListener(async () => {
  const config = await getConfig()
  await paintBadge(config)
  if (config.settings.organizeOnStartup) await organizeAll(config, 'allWindows')
})

/* ------------------------------------------------------------- duplicates --

   A tab is "new" from the moment it is created until its first web page
   commits; only then is it checked against the tabs already open. Judging a
   later navigation would close a tab the user has been working in just because
   they clicked a link to somewhere that happens to be open elsewhere.

   The set lives in memory. If the worker is recycled before the page commits
   the tab simply is not merged, which is the safe way to get it wrong. */
const freshTabs = new Set<number>()

/**
 * Merges run one at a time. Two identical tabs opened together would otherwise
 * each see the other as the original and both close themselves.
 */
let mergeQueue: Promise<unknown> = Promise.resolve()

function mergeLater(tabId: number): void {
  mergeQueue = mergeQueue
    .then(async () => {
      if ((await getConfig()).settings.mergeDuplicates) await mergeIfDuplicate(tabId)
    })
    .catch(() => {})
}

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id === undefined) return
  // A tab that arrives already showing a page is not the user opening something
  // new, so it is never merged. A fresh tab has no committed page yet.
  if (duplicateKey(tab.url) === null) freshTabs.add(tab.id)
  schedule(tab.id)
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (freshTabs.has(tabId) && duplicateKey(changeInfo.url) !== null) {
    freshTabs.delete(tabId)
    mergeLater(tabId)
  }
  // Only react to navigation and load completion. Reacting to `groupId` here
  // would make our own grouping call re-trigger this listener.
  if (changeInfo.url === undefined && changeInfo.status !== 'complete') return
  schedule(tabId)
})

chrome.tabs.onRemoved.addListener((tabId) => {
  freshTabs.delete(tabId)
  const timer = pending.get(tabId)
  if (timer) clearTimeout(timer)
  pending.delete(tabId)
})

chrome.runtime.onMessage.addListener((request: Request, _sender, respond) => {
  void (async () => {
    const config = await getConfig()
    switch (request.type) {
      case 'ORGANIZE_NOW':
        respond(await organizeAll(config, request.scope))
        return
      case 'UNGROUP_ALL':
        respond({ tabsUngrouped: await ungroupManaged(config, request.scope) })
        return
      case 'SUMMARY':
        respond(await summarize(config, request.scope))
        return
    }
  })()
  // Keeps the message channel open for the async work above.
  return true
})

/* ---------------------------------------------------------------- omnibox --

   Typing the keyword in the address bar searches the tabs that are already
   open, so jumping to one never needs the popup. */

const OMNIBOX_LIMIT = 8

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

/** Suggestion descriptions are parsed as XML, so page titles have to be escaped. */
const escapeXml = (text: string) => text.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char)

chrome.omnibox.setDefaultSuggestion({
  description: 'Search your open tabs — type part of a title or address',
})

chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  void (async () => {
    const tabs = await chrome.tabs.query({})
    suggest(
      searchTabs(tabs, text)
        .slice(0, OMNIBOX_LIMIT)
        .map((tab) => ({
          // The URL doubles as the suggestion's identity and as something
          // readable once Chrome drops it into the address bar.
          content: tab.url ?? '',
          description: `<match>${escapeXml(tab.title ?? '')}</match> <dim>${escapeXml(hostOf(tab.url ?? ''))}</dim>`,
        })),
    )
  })()
})

chrome.omnibox.onInputEntered.addListener((text) => {
  void (async () => {
    const tabs = await chrome.tabs.query({})
    // An exact URL means the user picked a suggestion; anything else is a query
    // they typed and submitted without choosing, so take the best match.
    const target = tabs.find((tab) => tab.url === text) ?? searchTabs(tabs, text)[0]
    if (target) await focusTab(target)
  })()
})
