import { DEFAULT_TEMPLATE_IDS, TEMPLATES_BY_ID, type Template } from './templates.ts'
import { GROUP_COLORS, MATCH_KINDS, type Config, type Group, type Rule, type Settings } from './types.ts'

const STORAGE_KEY = 'tabOrganiser.config'
export const CONFIG_VERSION = 1

export const DEFAULT_SETTINGS: Settings = {
  autoOrganize: true,
  organizeOnStartup: false,
  includePinned: false,
  scope: 'allWindows',
  moveMismatched: true,
  ungroupUnmatched: false,
}

export const newId = (): string => crypto.randomUUID()

export const makeRule = (partial: Partial<Rule> = {}): Rule => ({
  id: newId(),
  kind: 'domain',
  value: '',
  enabled: true,
  ...partial,
})

export const makeGroup = (partial: Partial<Group> = {}): Group => ({
  id: newId(),
  name: 'New group',
  color: 'blue',
  rules: [],
  enabled: true,
  collapse: false,
  ...partial,
})

export function groupFromTemplate(template: Template): Group {
  return makeGroup({
    name: template.name,
    color: template.color,
    rules: template.domains.map((domain) => makeRule({ kind: 'domain', value: domain })),
  })
}

export function defaultConfig(): Config {
  return {
    version: CONFIG_VERSION,
    onboarded: false,
    groups: DEFAULT_TEMPLATE_IDS.map((id) => TEMPLATES_BY_ID.get(id))
      .filter((template): template is Template => Boolean(template))
      .map(groupFromTemplate),
    settings: { ...DEFAULT_SETTINGS },
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const pickEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

const pickBool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

/**
 * Config can arrive from an older version of the extension or from a
 * hand-edited JSON import, so coerce every field instead of trusting the shape.
 */
export function parseConfig(raw: unknown): Config {
  if (!isRecord(raw)) return defaultConfig()

  const groups = Array.isArray(raw.groups)
    ? raw.groups.filter(isRecord).map((group) =>
        makeGroup({
          id: typeof group.id === 'string' ? group.id : newId(),
          name: typeof group.name === 'string' && group.name.trim() ? group.name.trim() : 'Untitled',
          color: pickEnum(group.color, GROUP_COLORS, 'blue'),
          enabled: pickBool(group.enabled, true),
          collapse: pickBool(group.collapse, false),
          rules: Array.isArray(group.rules)
            ? group.rules.filter(isRecord).map((rule) =>
                makeRule({
                  id: typeof rule.id === 'string' ? rule.id : newId(),
                  kind: pickEnum(rule.kind, MATCH_KINDS, 'domain'),
                  value: typeof rule.value === 'string' ? rule.value : '',
                  enabled: pickBool(rule.enabled, true),
                }),
              )
            : [],
        }),
      )
    : defaultConfig().groups

  const rawSettings = isRecord(raw.settings) ? raw.settings : {}

  return {
    version: CONFIG_VERSION,
    onboarded: pickBool(raw.onboarded, false),
    groups,
    settings: {
      autoOrganize: pickBool(rawSettings.autoOrganize, DEFAULT_SETTINGS.autoOrganize),
      organizeOnStartup: pickBool(rawSettings.organizeOnStartup, DEFAULT_SETTINGS.organizeOnStartup),
      includePinned: pickBool(rawSettings.includePinned, DEFAULT_SETTINGS.includePinned),
      scope: pickEnum(rawSettings.scope, ['currentWindow', 'allWindows'] as const, DEFAULT_SETTINGS.scope),
      moveMismatched: pickBool(rawSettings.moveMismatched, DEFAULT_SETTINGS.moveMismatched),
      ungroupUnmatched: pickBool(rawSettings.ungroupUnmatched, DEFAULT_SETTINGS.ungroupUnmatched),
    },
  }
}

export async function loadConfig(): Promise<Config> {
  const stored = await chrome.storage.local.get(STORAGE_KEY)
  const raw = stored[STORAGE_KEY]
  if (raw === undefined) return defaultConfig()
  return parseConfig(raw)
}

export async function saveConfig(config: Config): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: { ...config, version: CONFIG_VERSION } })
}

/** Seeds storage on install without clobbering an existing config. */
export async function ensureConfig(): Promise<Config> {
  const stored = await chrome.storage.local.get(STORAGE_KEY)
  if (stored[STORAGE_KEY] !== undefined) return parseConfig(stored[STORAGE_KEY])
  const config = defaultConfig()
  await saveConfig(config)
  return config
}

/** Fires whenever the config changes, whatever page made the change. */
export function onConfigChanged(listener: (config: Config) => void): () => void {
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: chrome.storage.AreaName,
  ) => {
    if (area !== 'local') return
    const change = changes[STORAGE_KEY]
    if (!change) return
    listener(parseConfig(change.newValue))
  }
  chrome.storage.onChanged.addListener(handler)
  return () => chrome.storage.onChanged.removeListener(handler)
}
