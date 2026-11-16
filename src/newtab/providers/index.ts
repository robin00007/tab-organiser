import type { Provider } from '../../lib/universal.ts'
import { tabsProvider } from './tabs.ts'
import { webProvider } from './web.ts'
import { youtubeProvider } from './youtube.ts'

/**
 * Every source the universal search bar can draw from.
 *
 * Adding one is a new file in this folder that exports a `Provider`, plus a line
 * here. Give it a `trigger` such as `/bm` and it shows up in the command list.
 * Order is the order the commands are listed in.
 *
 * A website's own search is even smaller: see `youtube.ts`, which is a single
 * `siteProvider({ ... })` call.
 */
export const COMMANDS: readonly Provider[] = [tabsProvider, youtubeProvider]

/** Where text that is not addressed to a command goes. */
export const FALLBACK: Provider = webProvider

export const ALL_PROVIDERS: readonly Provider[] = [...COMMANDS, FALLBACK]
