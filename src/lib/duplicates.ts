/** The subset of `chrome.tabs.Tab` needed to decide whether two tabs show the same page. */
export interface TabIdentity {
  id?: number | undefined
  windowId?: number | undefined
  incognito?: boolean | undefined
  url?: string | undefined
}

const WEB_URL = /^https?:\/\//i

/**
 * What makes two tabs "the same page", or `null` when a tab can never be a
 * duplicate of anything.
 *
 * Only web pages qualify: two blank new-tab pages or two `chrome://` pages are
 * not duplicates in any useful sense. The URL is compared in its parsed form so
 * `https://Example.com` and `https://example.com/` agree, but the query and the
 * fragment stay — `#inbox` and `#sent` are different views of the same app.
 */
export function duplicateKey(url: string | undefined): string | null {
  if (!url || !WEB_URL.test(url)) return null
  try {
    return new URL(url).href
  } catch {
    return null
  }
}

/**
 * The already-open tab that `tab` duplicates, if there is one. A copy in the
 * same window wins so a merge does not drag the user across windows when it
 * does not have to; an incognito tab only ever matches another incognito tab.
 */
export function findExistingTab<T extends TabIdentity>(tab: T, others: readonly T[]): T | null {
  const key = duplicateKey(tab.url)
  if (key === null) return null

  const copies = others.filter(
    (other) =>
      other.id !== tab.id &&
      Boolean(other.incognito) === Boolean(tab.incognito) &&
      duplicateKey(other.url) === key,
  )
  return copies.find((other) => other.windowId === tab.windowId) ?? copies[0] ?? null
}
