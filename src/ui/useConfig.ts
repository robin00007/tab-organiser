import { useCallback, useEffect, useRef, useState } from 'react'
import { loadConfig, onConfigChanged, parseConfig, saveConfig } from '../lib/storage.ts'
import type { Config } from '../lib/types.ts'

export type UpdateConfig = (recipe: (previous: Config) => Config) => void

/**
 * A config as it looks after a round trip through storage. Anything we write
 * comes back through `parseConfig` (names trimmed, defaults filled in), so our
 * own writes are recognised by this form rather than by the text we typed.
 */
const fingerprint = (config: Config) => JSON.stringify(parseConfig(config))

/** How many un-echoed writes to remember, in case storage never reports one back. */
const MAX_PENDING = 32

/**
 * Reads the config once, then stays in sync with the other extension pages.
 * Writes are optimistic: local state updates immediately and storage catches
 * up, so typing in the options page never waits on IO.
 */
export function useConfig(): { config: Config | null; update: UpdateConfig } {
  const [config, setConfig] = useState<Config | null>(null)
  // Every write of ours comes back through the change listener. Applying that
  // echo would overwrite whatever has been typed since (a half-typed name, a
  // trailing space), so each write is remembered and its echo dropped. A set,
  // not a single value: two quick keystrokes mean two echoes in flight.
  const pendingEchoes = useRef(new Set<string>())

  useEffect(() => {
    void loadConfig().then(setConfig)
    return onConfigChanged((next) => {
      if (pendingEchoes.current.delete(fingerprint(next))) return
      setConfig(next)
    })
  }, [])

  const update = useCallback<UpdateConfig>((recipe) => {
    setConfig((previous) => {
      if (!previous) return previous
      const next = recipe(previous)
      const pending = pendingEchoes.current
      pending.add(fingerprint(next))
      if (pending.size > MAX_PENDING) pending.delete(pending.values().next().value as string)
      void saveConfig(next)
      return next
    })
  }, [])

  return { config, update }
}
