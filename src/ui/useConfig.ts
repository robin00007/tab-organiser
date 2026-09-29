import { useCallback, useEffect, useRef, useState } from 'react'
import { loadConfig, onConfigChanged, saveConfig } from '../lib/storage.ts'
import type { Config } from '../lib/types.ts'

export type UpdateConfig = (recipe: (previous: Config) => Config) => void

/**
 * Reads the config once, then stays in sync with the other extension pages.
 * Writes are optimistic: local state updates immediately and storage catches
 * up, so typing in the options page never waits on IO.
 */
export function useConfig(): { config: Config | null; update: UpdateConfig } {
  const [config, setConfig] = useState<Config | null>(null)
  // Our own writes come back through the change listener; ignoring that echo
  // keeps controlled inputs from re-rendering against stale text.
  const lastWritten = useRef<string | null>(null)

  useEffect(() => {
    void loadConfig().then(setConfig)
    return onConfigChanged((next) => {
      if (JSON.stringify(next) === lastWritten.current) return
      setConfig(next)
    })
  }, [])

  const update = useCallback<UpdateConfig>((recipe) => {
    setConfig((previous) => {
      if (!previous) return previous
      const next = recipe(previous)
      lastWritten.current = JSON.stringify(next)
      void saveConfig(next)
      return next
    })
  }, [])

  return { config, update }
}
