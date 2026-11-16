/** Every kind of rule a group can match on. */
export const MATCH_KINDS = ['domain', 'prefix', 'keyword', 'regex'] as const
export type MatchKind = (typeof MATCH_KINDS)[number]

export const MATCH_KIND_LABELS: Record<MatchKind, string> = {
  domain: 'Domain',
  prefix: 'URL starts with',
  keyword: 'Contains',
  regex: 'Regex',
}

export const MATCH_KIND_HINTS: Record<MatchKind, string> = {
  domain: 'youtube.com — also matches music.youtube.com',
  prefix: 'https://github.com/myorg/',
  keyword: 'invoice — looks in the URL and the page title',
  regex: '^https://.*\\.atlassian\\.net/browse/',
}

/** The nine colours Chrome allows on a tab group. */
export const GROUP_COLORS = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
] as const
export type GroupColor = (typeof GROUP_COLORS)[number]

export interface Rule {
  id: string
  kind: MatchKind
  value: string
  enabled: boolean
}

export interface Group {
  id: string
  name: string
  color: GroupColor
  rules: Rule[]
  enabled: boolean
  /** Collapse the Chrome tab group right after tabs are put into it. */
  collapse: boolean
}

export type Scope = 'currentWindow' | 'allWindows'

/** The four parts of the day. They drive both the greeting and the background. */
export const TIMES_OF_DAY = ['morning', 'afternoon', 'evening', 'night'] as const
export type TimeOfDay = (typeof TIMES_OF_DAY)[number]

/** `auto` follows the clock; the rest pin the new tab page to one time of day. */
export const SCENES = ['auto', ...TIMES_OF_DAY] as const
export type Scene = (typeof SCENES)[number]

/** `auto` follows the browser's locale. */
export const CLOCK_MODES = ['auto', '12h', '24h'] as const
export type ClockMode = (typeof CLOCK_MODES)[number]

export interface Settings {
  /** Group tabs as they are opened or navigated. */
  autoOrganize: boolean
  /** Run a full sweep when Chrome starts. */
  organizeOnStartup: boolean
  /** Pinned tabs are left alone unless this is on. */
  includePinned: boolean
  /** Which windows "Organise now" touches. */
  scope: Scope
  /** Move a tab when it sits in one of our groups but now matches another. */
  moveMismatched: boolean
  /** During a sweep, pull tabs out of our groups when they match nothing. */
  ungroupUnmatched: boolean
  /** Opening a page that is already open in another tab focuses and reloads that tab instead. */
  mergeDuplicates: boolean
  /** Shown in the new tab greeting. Empty means just "Good morning". */
  userName: string
  clock: ClockMode
  scene: Scene
}

export interface Config {
  version: number
  onboarded: boolean
  groups: Group[]
  settings: Settings
}

/** The subset of `chrome.tabs.Tab` the matcher actually needs. */
export interface TabLike {
  url?: string | undefined
  title?: string | undefined
}

export interface OrganizeResult {
  tabsMoved: number
  groupsTouched: number
  tabsUngrouped: number
}
