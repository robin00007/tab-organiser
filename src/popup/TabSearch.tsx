import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Globe, Search, X } from 'lucide-react'
import { hostOf } from '../lib/matching.ts'
import { searchTabs } from '../lib/search.ts'
import { GROUP_COLORS, type GroupColor } from '../lib/types.ts'
import { ColorDot, IconButton, Input, cx, plural } from '../ui/components.tsx'

type Tab = chrome.tabs.Tab

const MAX_RESULTS = 30
const NO_GROUP = chrome.tabGroups?.TAB_GROUP_ID_NONE ?? -1

/** Where a tab sits in Chrome right now — the badge on a result row. */
interface OpenGroup {
  title: string
  color: GroupColor
}

const wrap = (index: number, length: number) => (length === 0 ? 0 : (index + length) % length)

/**
 * One list of every tab, current window first. `searchTabs` breaks score ties
 * on this order, so the tab in front of you beats an identical one elsewhere.
 */
async function snapshotTabs(): Promise<Tab[]> {
  const [current, all] = await Promise.all([
    chrome.tabs.query({ currentWindow: true }),
    chrome.tabs.query({}),
  ])
  const seen = new Set(current.map((tab) => tab.id))
  return [...current, ...all.filter((tab) => !seen.has(tab.id))]
}

/** Chrome types the colour loosely; narrow it before it reaches `ColorDot`. */
const pickColor = (color: string): GroupColor =>
  GROUP_COLORS.includes(color as GroupColor) ? (color as GroupColor) : 'grey'

async function snapshotGroups(): Promise<Map<number, OpenGroup>> {
  const groups = await chrome.tabGroups.query({})
  return new Map(
    groups.map((group) => [group.id, { title: group.title ?? '', color: pickColor(group.color) }]),
  )
}

/**
 * Searches the tabs that are open right now — nothing is indexed or stored.
 *
 * The field, the result list and the highlight live in one component on
 * purpose: arrow keys have to move the highlight down the list while focus
 * stays in the field. `children` is what the popup shows while the field is
 * empty, so searching takes over the body instead of pushing it off-screen.
 */
export function TabSearch({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('')
  const [tabs, setTabs] = useState<Tab[]>([])
  const [openGroups, setOpenGroups] = useState<Map<number, OpenGroup>>(new Map())
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  // One snapshot per popup opening. A popup lives for seconds, and re-querying
  // per keystroke would reshuffle results as pages finish loading and retitle.
  useEffect(() => {
    void snapshotTabs().then(setTabs)
    void snapshotGroups().then(setOpenGroups)
  }, [])

  const results = useMemo(() => searchTabs(tabs, query).slice(0, MAX_RESULTS), [tabs, query])
  const searching = query.trim().length > 0
  // Closing a tab from the list shortens it under the stored index, so clamp on
  // read rather than chasing the results with another effect.
  const highlighted = Math.min(active, Math.max(results.length - 1, 0))

  useEffect(() => setActive(0), [query])

  useEffect(() => {
    listRef.current?.children[highlighted]?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  const jumpTo = async (tab: Tab) => {
    if (tab.id === undefined) return
    await chrome.tabs.update(tab.id, { active: true })
    await chrome.windows.update(tab.windowId, { focused: true })
    window.close()
  }

  const closeTab = async (tab: Tab) => {
    if (tab.id === undefined) return
    await chrome.tabs.remove(tab.id)
    setTabs((previous) => previous.filter((candidate) => candidate.id !== tab.id))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(wrap(highlighted + (event.key === 'ArrowDown' ? 1 : -1), results.length))
      return
    }
    if (event.key === 'Enter') {
      const tab = results[highlighted]
      if (tab) void jumpTo(tab)
      return
    }
    if (event.key === 'Escape' && searching) {
      // Clear first, close the popup only on a second press.
      event.preventDefault()
      setQuery('')
    }
  }

  return (
    <>
      <div className="relative px-3 py-2.5">
        <Search className="pointer-events-none absolute top-1/2 left-5 size-3.5 -translate-y-1/2 text-zinc-400" />
        <Input
          value={query}
          autoFocus
          spellCheck={false}
          aria-label="Search open tabs"
          placeholder="Search open tabs…"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          className="pr-8 pl-8"
        />
        {searching ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery('')}
            className="absolute top-1/2 right-5 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {!searching ? (
        children
      ) : results.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
          No open tab matches &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <section className="px-3 py-2">
          <div className="flex items-baseline justify-between pb-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>
              {results.length === MAX_RESULTS ? `First ${MAX_RESULTS} matches` : plural(results.length, 'open tab')}
            </span>
            <span>&uarr;&darr; to move &middot; &crarr; to jump</span>
          </div>
          <ul ref={listRef} className="max-h-72 space-y-0.5 overflow-y-auto">
            {results.map((tab, index) => (
              <li key={tab.id}>
                <Result
                  tab={tab}
                  group={tab.groupId !== NO_GROUP ? openGroups.get(tab.groupId) : undefined}
                  highlighted={index === highlighted}
                  onJump={() => void jumpTo(tab)}
                  onClose={() => void closeTab(tab)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function Result({
  tab,
  group,
  highlighted,
  onJump,
  onClose,
}: {
  tab: Tab
  group: OpenGroup | undefined
  highlighted: boolean
  onJump: () => void
  onClose: () => void
}) {
  const host = hostOf(tab.url ?? '')

  return (
    <div
      className={cx(
        'group flex items-center gap-2 rounded px-1.5 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800/60',
        highlighted && 'bg-indigo-50 dark:bg-indigo-950/60',
      )}
    >
      {/* A separate sibling button, not a nested one: closing a tab must not
          also activate it. */}
      <button type="button" onClick={onJump} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <Favicon src={tab.favIconUrl} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{tab.title || host || tab.url}</span>
          <span className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">
            {host || tab.url}
          </span>
        </span>
        {group?.title ? (
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            <ColorDot color={group.color} />
            <span className="max-w-20 truncate">{group.title}</span>
          </span>
        ) : null}
      </button>
      <IconButton
        label="Close tab"
        onClick={onClose}
        className="size-6 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <X className="size-3.5" />
      </IconButton>
    </div>
  )
}

/** Favicons come from the page, so they go missing often enough to plan for. */
function Favicon({ src }: { src: string | undefined }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) return <Globe className="size-4 shrink-0 text-zinc-400" />
  return <img src={src} alt="" className="size-4 shrink-0 rounded-sm" onError={() => setBroken(true)} />
}
