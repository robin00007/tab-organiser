import type { Group, MatchKind, Rule, TabLike } from './types.ts'

/** Pages the extension must never touch: browser internals and blank tabs. */
const UNORGANIZABLE = /^(chrome|chrome-extension|edge|brave|opera|vivaldi|about|devtools|view-source|file|data|blob):/i

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
          .replace(/^[a-z-]+:\/\//i, '')
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

export function ruleMatches(rule: Rule, tab: TabLike): boolean {
  if (!rule.enabled) return false
  const url = tab.url
  if (!isOrganizable(url)) return false

  const value = normalizeRuleValue(rule.kind, rule.value)
  if (!value) return false
  const lowerUrl = url.toLowerCase()

  switch (rule.kind) {
    case 'domain': {
      const host = hostOf(url)
      // An exact host, or any subdomain of it — never a suffix collision like
      // "notgithub.com" matching the rule "github.com".
      return host === value || host.endsWith(`.${value}`)
    }
    case 'prefix':
      // A scheme-less rule such as "github.com/myorg/" should still match, so
      // try the URL with its scheme stripped as well.
      return lowerUrl.startsWith(value) || lowerUrl.replace(/^[a-z-]+:\/\//, '').startsWith(value)
    case 'keyword':
      return lowerUrl.includes(value) || (tab.title ?? '').toLowerCase().includes(value)
    case 'regex':
      return compile(value)?.test(url) ?? false
  }
}

/**
 * The first enabled group with a matching rule wins, which makes group order
 * the priority knob — users reorder in the options page to break ties.
 *
 * A group with no name is skipped: Chrome groups are re-found by title, so an
 * untitled one would be recreated on every sweep instead of reused.
 */
export function findGroupForTab(groups: Group[], tab: TabLike): Group | null {
  if (!isOrganizable(tab.url)) return null
  for (const group of groups) {
    if (!group.enabled || !group.name.trim()) continue
    if (group.rules.some((rule) => ruleMatches(rule, tab))) return group
  }
  return null
}
