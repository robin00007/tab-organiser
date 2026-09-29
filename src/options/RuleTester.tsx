import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { isOrganizable, ruleMatches } from '../lib/matching.ts'
import { MATCH_KIND_LABELS, type Group } from '../lib/types.ts'
import { ColorDot, Input } from '../ui/components.tsx'

/**
 * Answers "why did this tab end up there?" without the user having to open the
 * page. Mirrors `findGroupForTab` but keeps hold of the rule that won.
 */
function explain(groups: Group[], url: string) {
  for (const group of groups) {
    if (!group.enabled) continue
    const rule = group.rules.find((candidate) => ruleMatches(candidate, { url }))
    if (rule) return { group, rule }
  }
  return null
}

export function RuleTester({ groups }: { groups: Group[] }) {
  const [url, setUrl] = useState('')
  const trimmed = url.trim()
  const hit = trimmed ? explain(groups, trimmed) : null

  return (
    <div className="max-w-xl space-y-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <FlaskConical className="size-4 text-indigo-600 dark:text-indigo-400" />
        Try a URL
      </h3>
      <Input
        value={url}
        spellCheck={false}
        placeholder="https://www.youtube.com/watch?v=…"
        onChange={(event) => setUrl(event.target.value)}
        className="font-mono text-xs"
      />
      {trimmed ? (
        !isOrganizable(trimmed) ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Browser pages like this one are always left alone.
          </p>
        ) : hit ? (
          <p className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">Lands in</span>
            <span className="inline-flex items-center gap-1 font-medium">
              <ColorDot color={hit.group.color} />
              {hit.group.name}
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">
              via {MATCH_KIND_LABELS[hit.rule.kind].toLowerCase()}
            </span>
            <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">{hit.rule.value}</code>
          </p>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">No group matches this URL yet.</p>
        )
      ) : null}
    </div>
  )
}
