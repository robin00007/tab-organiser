import type { Group, MatchKind, Rule, TabLike } from './types.ts'

/** Pages the extension must never touch: browser internals and blank tabs. */
const UNORGANIZABLE = /^(chrome|chrome-extension|edge|brave|opera|vivaldi|about|devtools|view-source|file|data|blob):/i

const SCHEME = /^[a-z-]+:\/\//i

export function isOrganizable(url: string | undefined): url is string {
  if (!url) return false
  return !UNORGANIZABLE.test(url)
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** A URL without its scheme — the yardstick every rule's reach is measured on. */
const bare = (value: string) => value.replace(SCHEME, '')

/**
 * Accepts whatever the user pasted — a full URL, a bare host, a host with a
 * trailing slash — and reduces it to the shape the matcher compares against.
 */
export function normalizeRuleValue(kind: MatchKind, raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  switch (kind) {
    case 'domain':
      return (
        value
          .replace(SCHEME, '')
          .replace(/^www\./i, '')
          .replace(/[/?#].*$/, '')
          .replace(/:\d+$/, '')
          .toLowerCase() || ''
      )
    case 'prefix':
      return value.toLowerCase()
    case 'keyword':
      return value.toLowerCase()
    case 'regex':
      return value
  }
}

// Compiling a regex per tab per rule adds up during a full sweep, so keep the
// compiled form (or the failure) around and key it by the source string.
const regexCache = new Map<string, RegExp | null>()

function compile(source: string): RegExp | null {
  const cached = regexCache.get(source)
  if (cached !== undefined) return cached
  let compiled: RegExp | null = null
  try {
    compiled = new RegExp(source, 'i')
  } catch {
    compiled = null
  }
  regexCache.set(source, compiled)
  return compiled
}

export function isValidRule(rule: Pick<Rule, 'kind' | 'value'>): boolean {
  const value = normalizeRuleValue(rule.kind, rule.value)
  if (!value) return false
  return rule.kind === 'regex' ? compile(value) !== null : true
}

/**
 * How much of the URL a rule pins down, counted in characters of the URL with
 * its scheme stripped. `null` means the rule does not match this tab at all.
 *
 * This number is what settles a tug of war between two groups that both claim a
 * tab: on `https://www.instagram.com/robin0007`, the domain rule
 * `instagram.com` pins 13 characters and the prefix rule
 * `www.instagram.com/robin0007` pins 27, so the prefix wins.
 */
export function ruleScore(rule: Rule, tab: TabLike): number | null {
  if (!rule.enabled) return null
  const url = tab.url
  if (!isOrganizable(url)) return null

  const value = normalizeRuleValue(rule.kind, rule.value)
  if (!value) return null
  const lowerUrl = url.toLowerCase()

  switch (rule.kind) {
    case 'domain': {
      const host = hostOf(url)
      // An exact host, or any subdomain of it — never a suffix collision like
      // "notgithub.com" matching the rule "github.com".
      if (host !== value && !host.endsWith(`.${value}`)) return null
      return value.length
    }
    case 'prefix':
      // A scheme-less rule such as "github.com/myorg/" should still match, so
      // try the URL with its scheme stripped as well.
      if (!lowerUrl.startsWith(value) && !bare(lowerUrl).startsWith(value)) return null
      return bare(value).length
    case 'keyword':
      if (!lowerUrl.includes(value) && !(tab.title ?? '').toLowerCase().includes(value)) return null
      // Scored on the keyword's own length, since a title hit pins down nothing
      // about the URL: a long, unusual word is still a specific claim.
      return value.length
    case 'regex': {
      const hit = compile(value)?.exec(url)
      return hit ? bare(hit[0]).length : null
    }
  }
}

export function ruleMatches(rule: Rule, tab: TabLike): boolean {
  return ruleScore(rule, tab) !== null
}

export interface TabMatch {
  group: Group
  /** The rule that won, so the UI can explain the decision. */
  rule: Rule
  /** Characters of the URL that rule pins down — see `ruleScore`. */
  score: number
}

/**
 * The rule of this group that pins down the most of the tab's URL, if any.
 *
 * A group with no name is skipped: Chrome groups are re-found by title, so an
 * untitled one would be recreated on every sweep instead of reused.
 */
function bestRuleFor(group: Group, tab: TabLike): TabMatch | null {
  if (!group.enabled || !group.name.trim()) return null
  let best: TabMatch | null = null
  for (const rule of group.rules) {
    const score = ruleScore(rule, tab)
    if (score !== null && (best === null || score > best.score)) best = { group, rule, score }
  }
  return best
}

/**
 * The group that claims the tab most specifically wins, so a rule for
 * `instagram.com/robin0007` beats one for `instagram.com` wherever its group
 * sits in the list. Groups that pin down exactly as much are settled by their
 * order, which keeps list position the tie-breaker it has always been.
 */
export function findMatchForTab(groups: Group[], tab: TabLike): TabMatch | null {
  if (!isOrganizable(tab.url)) return null
  let best: TabMatch | null = null
  for (const group of groups) {
    const match = bestRuleFor(group, tab)
    // Strictly greater, so the earliest group to reach a score keeps it.
    if (match && (best === null || match.score > best.score)) best = match
  }
  return best
}

/** Every group that claims this tab, most specific first. For explaining ties. */
export function rankMatchesForTab(groups: Group[], tab: TabLike): TabMatch[] {
  if (!isOrganizable(tab.url)) return []
  return groups
    .map((group) => bestRuleFor(group, tab))
    .filter((match): match is TabMatch => match !== null)
    // `sort` is stable, so equal scores stay in the order the user set.
    .sort((a, b) => b.score - a.score)
}

export function findGroupForTab(groups: Group[], tab: TabLike): Group | null {
  return findMatchForTab(groups, tab)?.group ?? null
}
