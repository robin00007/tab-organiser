import { ensureConfig, loadConfig, onConfigChanged } from '../lib/storage.ts'
import { hostOf } from '../lib/matching.ts'
import { organizeAll, organizeTab, summarize, ungroupManaged } from '../lib/organizer.ts'
import { searchTabs } from '../lib/search.ts'
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

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id !== undefined) schedule(tab.id)
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // Only react to navigation and load completion. Reacting to `groupId` here
  // would make our own grouping call re-trigger this listener.
  if (changeInfo.url === undefined && changeInfo.status !== 'complete') return
  schedule(tabId)
})

chrome.tabs.onRemoved.addListener((tabId) => {
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

/** Focuses a tab wherever it lives, pulling its window forward if need be. */
async function focusTab(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined) return
  await chrome.tabs.update(tab.id, { active: true })
  await chrome.windows.update(tab.windowId, { focused: true })
}

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
