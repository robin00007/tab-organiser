import { hostOf } from './matching.ts'

/** The subset of `chrome.tabs.Tab` the search needs. */
export interface SearchableTab {
  title?: string | undefined
  url?: string | undefined
}

/**
 * Where a token landed, best first. A hit at the start of the title or host is
 * what the user most likely meant; text buried in a query string is the weakest
 * signal, so `youtube` ranks a YouTube tab above one that merely links to it.
 */
interface FieldWeights {
  /** The token opens the field. */
  start: number
  /** The token opens a word inside it. */
  word: number
  /** The token is in there somewhere. */
  anywhere: number
}

const TITLE_WEIGHTS: FieldWeights = { start: 10, word: 8, anywhere: 5 }
const HOST_WEIGHTS: FieldWeights = { start: 9, word: 7, anywhere: 4 }
const URL_WEIGHT = 1

const isBoundary = (char: string) => !/[a-z0-9]/i.test(char)

function scoreIn(haystack: string, token: string, weights: FieldWeights): number {
  const at = haystack.indexOf(token)
  if (at < 0) return 0
  if (at === 0) return weights.start
  // `indexOf` alone cannot tell "gram" in "instagram" from "gram" in "500 gram";
  // the character before the hit can.
  return isBoundary(haystack.charAt(at - 1)) ? weights.word : weights.anywhere
}

export const tokenize = (query: string): string[] => query.toLowerCase().split(/\s+/).filter(Boolean)

/**
 * Filters and ranks open tabs against a query. Every token has to land
 * somewhere — `yt music` keeps only tabs matching both — which makes adding a
 * word narrow the list the way typing in a search box should.
 *
 * Nothing is indexed or remembered: callers pass the tabs that are open right
 * now and get a subset of that same array back.
 */
export function searchTabs<T extends SearchableTab>(tabs: readonly T[], query: string): T[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return []

  const hits: { tab: T; score: number; order: number }[] = []

  tabs.forEach((tab, order) => {
    const title = (tab.title ?? '').toLowerCase()
    const url = (tab.url ?? '').toLowerCase()
    const host = hostOf(tab.url ?? '')

    let score = 0
    for (const token of tokens) {
      const best = Math.max(
        scoreIn(title, token, TITLE_WEIGHTS),
        scoreIn(host, token, HOST_WEIGHTS),
        url.includes(token) ? URL_WEIGHT : 0,
      )
      if (best === 0) return
      score += best
    }
    hits.push({ tab, score, order })
  })

  return hits.sort((a, b) => b.score - a.score || a.order - b.order).map((hit) => hit.tab)
}
