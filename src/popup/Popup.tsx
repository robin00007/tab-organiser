import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Check, Layers, Plus, Settings, Sparkles, Ungroup } from 'lucide-react'
import { findGroupForTab, hostOf, isOrganizable } from '../lib/matching.ts'
import { sendMessage } from '../lib/messages.ts'
import type { Summary } from '../lib/organizer.ts'
import { makeRule } from '../lib/storage.ts'
import type { Config, Scope } from '../lib/types.ts'
import { Button, ColorDot, IconButton, Select, Toggle, cx, plural } from '../ui/components.tsx'
import { useConfig } from '../ui/useConfig.ts'
import { TabSearch } from './TabSearch.tsx'

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'currentWindow', label: 'This window' },
  { value: 'allWindows', label: 'All windows' },
]

function useActiveTab() {
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null)
  useEffect(() => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([found]) => setTab(found ?? null))
  }, [])
  return tab
}

export function Popup() {
  const { config, update } = useConfig()
  const activeTab = useActiveTab()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const scope = config?.settings.scope ?? 'allWindows'

  const refresh = useCallback(async (nextScope: Scope) => {
    setSummary(await sendMessage({ type: 'SUMMARY', scope: nextScope }))
  }, [])

  useEffect(() => {
    if (!config) return
    const timer = setTimeout(() => void refresh(config.settings.scope), 150)
    return () => clearTimeout(timer)
  }, [config, refresh])

  if (!config) return <div className="h-40" />

  const run = async (action: 'organize' | 'ungroup') => {
    setBusy(true)
    setStatus(null)
    try {
      if (action === 'organize') {
        const result = await sendMessage({ type: 'ORGANIZE_NOW', scope })
        setStatus(
          result.tabsMoved === 0
            ? 'Everything is already in place.'
            : `Moved ${plural(result.tabsMoved, 'tab')} into ${plural(result.groupsTouched, 'group')}.`,
        )
      } else {
        const result = await sendMessage({ type: 'UNGROUP_ALL', scope })
        setStatus(
          result.tabsUngrouped === 0 ? 'No grouped tabs to release.' : `Released ${plural(result.tabsUngrouped, 'tab')}.`,
        )
      }
      await refresh(scope)
    } finally {
      setBusy(false)
    }
  }

  const matchedGroup = activeTab ? findGroupForTab(config.groups, activeTab) : null
  const host = activeTab?.url && isOrganizable(activeTab.url) ? hostOf(activeTab.url) : ''

  const addHostToGroup = (groupId: string) => {
    if (!host) return
    update((previous) => ({
      ...previous,
      groups: previous.groups.map((group) =>
        group.id === groupId
          ? { ...group, rules: [...group.rules, makeRule({ kind: 'domain', value: host })] }
          : group,
      ),
    }))
    setStatus(`${host} added.`)
  }

  const countFor = (groupId: string) =>
    summary?.previews.find((preview) => preview.groupId === groupId)?.matching ?? 0

  return (
    <div className="flex flex-col divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
      <header className="flex items-center gap-2 px-3 py-2.5">
        <Layers className="size-4 text-indigo-600 dark:text-indigo-400" />
        <h1 className="flex-1 font-semibold">Tab Organiser</h1>
        <IconButton label="Settings" onClick={() => void chrome.runtime.openOptionsPage()}>
          <Settings className="size-4" />
        </IconButton>
      </header>

      <TabSearch>
        <section className="px-3 py-3">
          <Toggle
            checked={config.settings.autoOrganize}
            onChange={(autoOrganize) =>
              update((previous) => ({ ...previous, settings: { ...previous.settings, autoOrganize } }))
            }
            label="Auto-organise new tabs"
            description="Group tabs the moment they load"
          />
        </section>

        {host ? (
          <section className="px-3 py-3">
            <p className="mb-2 truncate text-xs text-zinc-500 dark:text-zinc-400">
              This tab &middot; <span className="font-medium text-zinc-700 dark:text-zinc-200">{host}</span>
            </p>
            {matchedGroup ? (
              <p className="flex items-center gap-1.5 text-xs">
                <Check className="size-3.5 text-green-600 dark:text-green-400" />
                Goes to
                <span className="inline-flex items-center gap-1 font-medium">
                  <ColorDot color={matchedGroup.color} />
                  {matchedGroup.name}
                </span>
              </p>
            ) : (
              <QuickAdd groups={config.groups} onAdd={addHostToGroup} />
            )}
          </section>
        ) : null}

        <section className="space-y-2 px-3 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {summary ? `${summary.total} organisable tabs` : 'Counting…'}
            </span>
            <div className="flex rounded-md bg-zinc-100 p-0.5 dark:bg-zinc-800">
              {SCOPES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    update((previous) => ({
                      ...previous,
                      settings: { ...previous.settings, scope: option.value },
                    }))
                  }
                  className={cx(
                    'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                    scope === option.value
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100'
                      : 'text-zinc-500 dark:text-zinc-400',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <ul className="max-h-52 space-y-0.5 overflow-y-auto">
            {config.groups.map((group) => (
              <li
                key={group.id}
                className={cx('flex items-center gap-2 rounded px-1 py-1', !group.enabled && 'opacity-40')}
              >
                <ColorDot color={group.color} />
                <span className="flex-1 truncate">{group.name}</span>
                <span className="tabular-nums text-xs text-zinc-500 dark:text-zinc-400">{countFor(group.id)}</span>
              </li>
            ))}
            {summary && summary.unmatched > 0 ? (
              <li className="flex items-center gap-2 rounded px-1 py-1 text-zinc-500 dark:text-zinc-400">
                <span className="size-2.5 shrink-0 rounded-full border border-dashed border-current" />
                <span className="flex-1 truncate italic">Unmatched</span>
                <span className="tabular-nums text-xs">{summary.unmatched}</span>
              </li>
            ) : null}
          </ul>
        </section>

        <footer className="space-y-2 px-3 py-3">
          <Button variant="primary" className="w-full" disabled={busy} onClick={() => void run('organize')}>
            <Sparkles className="size-4" />
            Organise now
          </Button>
          <Button variant="ghost" className="w-full" disabled={busy} onClick={() => void run('ungroup')}>
            <Ungroup className="size-4" />
            Release my groups
          </Button>
          {status ? <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">{status}</p> : null}
        </footer>

        {/* An explicit way back to the editor — the header gear alone is too
            easy to miss once the welcome banner has been dismissed. */}
        <button
          type="button"
          onClick={() => void chrome.runtime.openOptionsPage()}
          className="group flex items-center gap-2 px-3 py-2.5 text-left text-xs text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100"
        >
          <span className="flex-1">Manage groups, rules and templates</span>
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </TabSearch>
    </div>
  )
}

function QuickAdd({
  groups,
  onAdd,
}: {
  groups: Config['groups']
  onAdd: (groupId: string) => void
}) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '')

  if (groups.length === 0) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        No groups yet — create one in settings to start sorting.
      </p>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="min-w-0 flex-1">
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </Select>
      <Button onClick={() => onAdd(groupId)}>
        <Plus className="size-3.5" />
        Add
      </Button>
    </div>
  )
}
