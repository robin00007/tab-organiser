import { ensureConfig, loadConfig, onConfigChanged } from '../lib/storage.ts'
import { organizeAll, organizeTab, summarize, ungroupManaged } from '../lib/organizer.ts'
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
