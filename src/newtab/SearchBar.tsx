import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowUpRight, Search, Slash, X } from 'lucide-react'
import { parseInput, type Result } from '../lib/universal.ts'
import { ColorDot, Favicon, cx, wrap } from '../ui/components.tsx'
import { ALL_PROVIDERS, COMMANDS, FALLBACK } from './providers/index.ts'

/** The glyph for rows that have no favicon of their own. */
const KIND_ICON = {
  tab: null,
  link: ArrowUpRight,
  search: Search,
  command: Slash,
} as const

/**
 * The universal search bar. The input, the list and the highlight live in one
 * component on purpose: arrow keys move the highlight while focus stays in the
 * field, which is the ARIA combobox pattern the roles below follow.
 *
 * It knows nothing about *what* it is searching. `parseInput` picks a source
 * from what was typed, the source returns rows, and picking a row runs its own
 * `activate`. New sources are registered in `providers/index.ts`.
 */
export function SearchBar() {
  const [text, setText] = useState('')
  const [answer, setAnswer] = useState<{ key: string; rows: Result[] }>({ key: '', rows: [] })
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const busy = useRef(false)
  const listId = useId()

  const parsed = useMemo(() => parseInput(text, COMMANDS, FALLBACK), [text])
  const source = parsed.mode === 'search' ? parsed.provider : null
  const query = parsed.mode === 'search' ? parsed.query : ''
  // An answer is only good for the exact question it was given.
  const key = source ? `${source.id}\u0000${query}` : ''

  // Chrome may leave the address bar focused on a new tab, so ask for focus more than once.
  useEffect(() => {
    window.focus()
    inputRef.current?.focus()
  }, [])

  // Sources that cache (open tabs) start fresh on arrival and whenever the user comes back.
  useEffect(() => {
    const refresh = () => {
      for (const provider of ALL_PROVIDERS) provider.refresh?.()
    }
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      refresh()
      inputRef.current?.focus()
    }
    refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    if (!source) return
    let stale = false
    source.search(query).then(
      (rows) => !stale && setAnswer({ key, rows }),
      () => !stale && setAnswer({ key, rows: [] }),
    )
    // A newer keystroke has superseded this question; its answer is no use.
    return () => {
      stale = true
    }
  }, [source, query, key])

  const rows = useMemo<Result[]>(() => {
    if (parsed.mode === 'commands') {
      return parsed.matches.map((provider) => ({
        id: `command:${provider.id}`,
        kind: 'command',
        title: provider.trigger ?? provider.label,
        subtitle: provider.hint,
        activate: () => {
          setText(`${provider.trigger ?? ''} `)
          inputRef.current?.focus()
        },
      }))
    }
    return answer.key === key ? answer.rows : []
  }, [parsed, answer, key])

  const answered = parsed.mode === 'search' && answer.key === key
  const highlighted = Math.min(active, Math.max(rows.length - 1, 0))

  useEffect(() => setActive(0), [text])
  useEffect(() => {
    listRef.current?.children[highlighted]?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  const run = async (row: Result) => {
    if (busy.current) return
    busy.current = true
    try {
      await row.activate()
    } catch {
      /* the tab or window may have gone while we were working */
    } finally {
      busy.current = false
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter while composing text (an IME) confirms the composition, not the search.
    if (event.nativeEvent.isComposing) return
    const row = rows[highlighted]

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        if (rows.length === 0) return
        event.preventDefault()
        setActive(wrap(highlighted + (event.key === 'ArrowDown' ? 1 : -1), rows.length))
        return
      case 'Enter':
        if (!row) return
        event.preventDefault()
        void run(row)
        return
      case 'Tab':
        // Tab completes a command; anywhere else it keeps its usual job.
        if (parsed.mode !== 'commands' || !row) return
        event.preventDefault()
        void run(row)
        return
      case 'Escape':
        if (!text) return
        event.preventDefault()
        setText('')
        return
    }
  }

  const label = source?.trigger ? source.label : null
  const open = rows.length > 0 || (answered && query !== '' && source !== FALLBACK)

  return (
    <div className="relative w-full">
      <div className="flex h-14 items-center gap-3 rounded-full border border-white/20 bg-black/25 px-5 shadow-lg shadow-black/20 backdrop-blur-xl transition-colors focus-within:border-white/45 focus-within:bg-black/35">
        <Search className="size-5 shrink-0 text-white/60" aria-hidden="true" />
        <input
          ref={inputRef}
          value={text}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={rows[highlighted] ? `${listId}-${highlighted}` : undefined}
          aria-label="Search the web, or type / for commands"
          placeholder="Search the web, or type / for commands"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-lg text-white outline-none placeholder:text-white/45"
        />
        {label ? (
          <span className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90">{label}</span>
        ) : null}
        {text ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setText('')
              inputRef.current?.focus()
            }}
            className="shrink-0 rounded-full p-1 text-white/55 transition-colors hover:text-white"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="absolute top-full right-0 left-0 z-20 mt-2 max-h-[min(55vh,26rem)] overflow-y-auto rounded-3xl border border-white/15 bg-black/45 p-1.5 shadow-2xl shadow-black/30 backdrop-blur-xl">
          {rows.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-white/65">
              Nothing matches &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <ul ref={listRef} id={listId} role="listbox" aria-label="Results">
              {rows.map((row, index) => (
                <li
                  key={row.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === highlighted}
                  onMouseMove={() => setActive(index)}
                  onClick={() => void run(row)}
                  className={cx(
                    'flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5',
                    index === highlighted && 'bg-white/15',
                  )}
                >
                  <RowIcon row={row} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-white">{row.title}</span>
                    {row.subtitle ? (
                      <span className="block truncate text-xs text-white/55">{row.subtitle}</span>
                    ) : null}
                  </span>
                  {row.badge ? (
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-white/65">
                      {row.badge.color ? <ColorDot color={row.badge.color} /> : null}
                      <span className="max-w-28 truncate">{row.badge.label}</span>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {!text ? (
        <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-sm text-white/60">
          {COMMANDS.map((provider) => (
            <li key={provider.id}>
              <kbd className="mr-1.5 rounded-md bg-white/12 px-1.5 py-0.5 font-mono text-xs text-white/85">
                {provider.trigger}
              </kbd>
              {provider.hint}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function RowIcon({ row }: { row: Result }) {
  const Glyph = KIND_ICON[row.kind]
  if (row.kind === 'tab') return <Favicon src={row.icon} className="size-5" />
  return (
    <span className="grid size-5 shrink-0 place-items-center text-white/70">
      {Glyph ? <Glyph className="size-[18px]" aria-hidden="true" /> : null}
    </span>
  )
}
