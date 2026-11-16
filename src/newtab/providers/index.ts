import type { Provider } from '../../lib/universal.ts'
import { tabsProvider } from './tabs.ts'
import { webProvider } from './web.ts'

/**
 * Every source the universal search bar can draw from.
 *
 * Adding one is a new file in this folder that exports a `Provider`, plus a line
 * here. Give it a `trigger` such as `/bm` and it shows up in the command list.
 */
export const COMMANDS: readonly Provider[] = [tabsProvider]

/** Where text that is not addressed to a command goes. */
export const FALLBACK: Provider = webProvider

export const ALL_PROVIDERS: readonly Provider[] = [...COMMANDS, FALLBACK]
