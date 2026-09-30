import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { isOrganizable, rankMatchesForTab } from '../lib/matching.ts'
import { MATCH_KIND_LABELS, type Group } from '../lib/types.ts'
import { ColorDot, Input } from '../ui/components.tsx'

export function RuleTester({ groups }: { groups: Group[] }) {
  const [url, setUrl] = useState('')
  const trimmed = url.trim()
  // Every group that claims the URL, not just the winner — when two groups both
  // cover a site, seeing the runners-up is the whole answer.
  const matches = trimmed ? rankMatchesForTab(groups, { url: trimmed }) : []
  const [winner, ...runnersUp] = matches

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
        ) : winner ? (
          <>
            <p className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">Lands in</span>
              <span className="inline-flex items-center gap-1 font-medium">
                <ColorDot color={winner.group.color} />
                {winner.group.name}
              </span>
              <Via kind={winner.rule.kind} value={winner.rule.value} />
            </p>
            {runnersUp.length > 0 ? (
              <div className="space-y-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {runnersUp.length === 1 ? 'One other group' : `${runnersUp.length} other groups`} also match
                  {runnersUp.length === 1 ? 'es' : ''}, less specifically:
                </p>
                {runnersUp.map((match) => (
                  <p
                    key={match.group.id}
                    className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400"
                  >
                    <ColorDot color={match.group.color} />
                    {match.group.name}
                    <Via kind={match.rule.kind} value={match.rule.value} />
                  </p>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">No group matches this URL yet.</p>
        )
      ) : null}
    </div>
  )
}

function Via({ kind, value }: { kind: keyof typeof MATCH_KIND_LABELS; value: string }) {
  return (
    <>
      <span className="text-zinc-500 dark:text-zinc-400">via {MATCH_KIND_LABELS[kind].toLowerCase()}</span>
      <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">{value}</code>
    </>
  )
}
