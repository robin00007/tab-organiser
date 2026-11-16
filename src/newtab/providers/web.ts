import { looksLikeUrl, toUrl, type Provider, type Result } from '../../lib/universal.ts'

/** Searches with whatever engine the user picked in Chrome, not one we chose for them. */
async function searchTheWeb(text: string): Promise<void> {
  const self = await chrome.tabs.getCurrent()
  await chrome.search.query(self?.id !== undefined ? { text, tabId: self.id } : { text })
}

/**
 * The default source: plain text lands here. Navigating the new tab itself,
 * rather than opening another, is what lets the service worker's duplicate merge
 * recognise a page that is already open.
 */
export const webProvider: Provider = {
  id: 'web',
  label: 'Web',
  hint: 'Search the web with your default search engine',

  async search(query) {
    const text = query.trim()
    if (!text) return []

    const search: Result = {
      id: 'web:search',
      kind: 'search',
      title: `Search the web for “${text}”`,
      subtitle: 'Your default search engine',
      activate: () => searchTheWeb(text),
    }
    if (!looksLikeUrl(text)) return [search]

    const url = toUrl(text)
    const open: Result = {
      id: 'web:open',
      kind: 'link',
      title: `Open ${text}`,
      subtitle: url,
      activate: () => window.location.assign(url),
    }
    // What the user most likely meant comes first, so Enter does the obvious thing.
    return [open, search]
  },
}
