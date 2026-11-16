import type { GroupColor } from './types.ts'

/**
 * One row in the universal search list. The search bar never needs to know what
 * a row *is*: it shows it, and calls `activate` when the user picks it.
 */
export interface Result {
  id: string
  /** Picks the glyph shown when the row has no `icon` of its own. */
  kind: 'tab' | 'link' | 'search' | 'command'
  title: string
  subtitle?: string | undefined
  /** An image URL, such as a tab's favicon. */
  icon?: string | undefined
  /** A small label on the right, such as the Chrome group a tab sits in. */
  badge?: { label: string; color?: GroupColor } | undefined
  activate(): Promise<void> | void
}

/**
 * A source the universal search bar can draw from. Adding a new one is one
 * object that satisfies this interface plus one line in the registry.
 */
export interface Provider {
  id: string
  /** What the user types to pick this source, such as `/tab`. The default source has none. */
  trigger?: string
  /** Other names for the same source, such as `/yt`. They work when typed but get no entry of their own in the command list. */
  aliases?: readonly string[]
  /** Badge text while the source is active, such as "Open tabs". */
  label: string
  /** One line explaining the source in the command list. */
  hint: string
  /** `query` is the text after the trigger. Answers may arrive late; the caller ignores stale ones. */
  search(query: string): Promise<Result[]>
  /** Called when the page becomes visible again, so a source can drop what it cached. */
  refresh?(): void
}

export type ParsedInput<P> =
  /** The text is addressed to one source. */
  | { mode: 'search'; provider: P; query: string }
  /** The user is still typing a command name; offer the ones that fit. */
  | { mode: 'commands'; matches: P[] }

/** Every command word a source answers to, lower-cased: its trigger and its aliases. */
const namesOf = (source: { trigger?: string; aliases?: readonly string[] }): string[] =>
  [source.trigger, ...(source.aliases ?? [])].filter((name): name is string => Boolean(name)).map((name) => name.toLowerCase())

/**
 * Splits what was typed into "which source" and "what to ask it".
 *
 * Anything that is not a command goes to `fallback`, whole and unchanged, so an
 * unknown `/usr/bin` or `/foo bar` is searched for rather than swallowed.
 */
export function parseInput<P extends { trigger?: string; aliases?: readonly string[] }>(
  text: string,
  commands: readonly P[],
  fallback: P,
): ParsedInput<P> {
  const plain: ParsedInput<P> = { mode: 'search', provider: fallback, query: text.trim() }

  const typed = text.trimStart()
  if (!typed.startsWith('/')) return plain

  // `/tab xyz` → word "tab", rest "xyz". `rest` stays undefined until a space is
  // typed, which is how "still choosing a command" differs from "chose one".
  const [, word = '', rest] = /^\/(\S*)(?:\s+([\s\S]*))?$/.exec(typed) ?? []
  const command = `/${word}`.toLowerCase()

  const exact = commands.find((candidate) => namesOf(candidate).includes(command))
  if (exact) return { mode: 'search', provider: exact, query: (rest ?? '').trim() }

  // Once a space follows an unknown word the user is not naming a command.
  if (rest !== undefined) return plain

  // A source is listed once however many of its names fit what was typed.
  const matches = commands.filter((candidate) => namesOf(candidate).some((name) => name.startsWith(command)))
  return matches.length > 0 ? { mode: 'commands', matches } : plain
}

/**
 * Fills in a site's search address. `{query}` marks where the text goes, and it
 * is escaped so `c++ & rust` cannot break out of the query string.
 */
export function buildSiteUrl(template: string, query: string): string {
  const escaped = encodeURIComponent(query.trim())
  return template.replace('{query}', () => escaped)
}

/**
 * Common endings only. A bare `file.py` or `main.rs` is far more likely a file
 * than a website, and a wrong guess here would navigate somewhere the user never
 * meant, so unfamiliar endings are treated as search terms instead.
 */
const COMMON_TLDS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'io', 'dev', 'app', 'co', 'ai', 'me', 'tv', 'xyz', 'info',
  'in', 'uk', 'us', 'ca', 'au', 'de', 'fr', 'jp', 'nl', 'es', 'it', 'br', 'ru', 'cn', 'eu',
])

const WEB_URL = /^https?:\/\/\S+$/i
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/
const HOST_LABEL = /^[\p{L}\p{N}-]+$/u

/** The host part of something typed without a scheme: no path, query or port. */
const bareHost = (text: string) => text.replace(/[/?#].*$/, '').replace(/:\d+$/, '')

export function looksLikeUrl(input: string): boolean {
  const text = input.trim()
  if (!text || /\s/.test(text)) return false
  if (WEB_URL.test(text)) return true

  const host = bareHost(text).toLowerCase()
  if (host === 'localhost' || IPV4.test(host)) return true

  const labels = host.split('.')
  if (labels.length < 2 || !labels.every((label) => HOST_LABEL.test(label))) return false
  return labels[0] === 'www' || COMMON_TLDS.has(labels[labels.length - 1] ?? '')
}

/** Turns something that `looksLikeUrl` into an address the browser can open. */
export function toUrl(input: string): string {
  const text = input.trim()
  if (/^https?:\/\//i.test(text)) return text
  const host = bareHost(text).toLowerCase()
  // Local servers rarely have a certificate, so assume plain http for them.
  const local = host === 'localhost' || IPV4.test(host)
  return `${local ? 'http' : 'https'}://${text}`
}
