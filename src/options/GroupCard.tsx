import { useState } from 'react'
import { ChevronDown, ChevronRight, ChevronUp, Eye, EyeOff, ListPlus, Plus, Trash2, X } from 'lucide-react'
import { isValidRule } from '../lib/matching.ts'
import { makeRule } from '../lib/storage.ts'
import {
  MATCH_KINDS,
  MATCH_KIND_HINTS,
  MATCH_KIND_LABELS,
  type Group,
  type MatchKind,
  type Rule,
} from '../lib/types.ts'
import { Button, ColorPicker, IconButton, Input, Select, Toggle, cx } from '../ui/components.tsx'

interface GroupCardProps {
  group: Group
  matching: number
  isFirst: boolean
  isLast: boolean
  /** Set when another group shares this name — they would merge in Chrome. */
  duplicateName: boolean
  onChange: (recipe: (group: Group) => Group) => void
  onMove: (direction: -1 | 1) => void
  onDelete: () => void
}

export function GroupCard({
  group,
  matching,
  isFirst,
  isLast,
  duplicateName,
  onChange,
  onMove,
  onDelete,
}: GroupCardProps) {
  const [bulkOpen, setBulkOpen] = useState(false)
  // A template drops in a dozen rules at once, so cards start closed and the
  // panel stays scannable. A fresh, empty group opens ready to type into.
  const [open, setOpen] = useState(group.rules.length === 0)
  // Chrome groups are matched back to config by title, so a name is required
  // and has to be unique.
  const nameProblem = !group.name.trim()
    ? 'Give the group a name — Chrome needs a title to reuse the group.'
    : duplicateName
      ? 'Another group has this name. Tabs from both will land in one Chrome group.'
      : null

  const patchRule = (ruleId: string, patch: Partial<Rule>) =>
    onChange((current) => ({
      ...current,
      rules: current.rules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
    }))

  const addRules = (rules: Rule[]) =>
    onChange((current) => ({ ...current, rules: [...current.rules, ...rules] }))

  return (
    <section
      className={cx(
        'rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
        !group.enabled && 'opacity-60',
      )}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-zinc-100 p-3 dark:border-zinc-800">
        <Input
          value={group.name}
          aria-label="Group name"
          onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))}
          className={cx('w-44 font-medium', nameProblem && 'border-amber-500 dark:border-amber-500')}
        />
        <ColorPicker
          value={group.color}
          onChange={(color) => onChange((current) => ({ ...current, color }))}
        />
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          {group.rules.length} {group.rules.length === 1 ? 'rule' : 'rules'}
        </button>
        <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          {matching} open {matching === 1 ? 'tab' : 'tabs'}
        </span>
        <div className="flex items-center">
          <IconButton label="Move up" disabled={isFirst} onClick={() => onMove(-1)}>
            <ChevronUp className="size-4" />
          </IconButton>
          <IconButton label="Move down" disabled={isLast} onClick={() => onMove(1)}>
            <ChevronDown className="size-4" />
          </IconButton>
          <IconButton
            label={group.enabled ? 'Disable group' : 'Enable group'}
            onClick={() => onChange((current) => ({ ...current, enabled: !current.enabled }))}
          >
            {group.enabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </IconButton>
          <IconButton
            label="Delete group"
            onClick={onDelete}
            className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </header>

      {nameProblem ? (
        <p className="px-3 pt-2 text-xs text-amber-600 dark:text-amber-400">{nameProblem}</p>
      ) : null}

      {!open ? (
        <div className="flex flex-wrap items-center gap-1 p-3">
          {group.rules.slice(0, 8).map((rule) => (
            <span
              key={rule.id}
              className={cx(
                'rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
                !rule.enabled && 'line-through opacity-50',
              )}
            >
              {rule.value || '—'}
            </span>
          ))}
          {group.rules.length > 8 ? (
            <span className="px-1 text-[11px] text-zinc-400">+{group.rules.length - 8} more</span>
          ) : null}
          {group.rules.length === 0 ? (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">No rules yet.</span>
          ) : null}
        </div>
      ) : (
      <div className="space-y-1.5 p-3">
        {group.rules.length === 0 ? (
          <p className="py-2 text-sm text-zinc-500 dark:text-zinc-400">
            No rules yet. Add a domain like <code className="text-xs">youtube.com</code> or a URL prefix.
          </p>
        ) : (
          group.rules.map((rule) => <RuleRow key={rule.id} rule={rule} onPatch={patchRule} onChange={onChange} />)
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1.5">
          <Button onClick={() => addRules([makeRule()])}>
            <Plus className="size-3.5" />
            Add rule
          </Button>
          <Button variant="ghost" onClick={() => setBulkOpen((open) => !open)}>
            <ListPlus className="size-3.5" />
            Paste a list
          </Button>
          <div className="ml-auto">
            <Toggle
              checked={group.collapse}
              onChange={(collapse) => onChange((current) => ({ ...current, collapse }))}
              label={<span className="text-xs font-normal">Collapse when organised</span>}
            />
          </div>
        </div>

        {bulkOpen ? <BulkAdd onAdd={(rules) => { addRules(rules); setBulkOpen(false) }} /> : null}
      </div>
      )}
    </section>
  )
}

function RuleRow({
  rule,
  onPatch,
  onChange,
}: {
  rule: Rule
  onPatch: (ruleId: string, patch: Partial<Rule>) => void
  onChange: (recipe: (group: Group) => Group) => void
}) {
  // An empty row is still being typed into, so only flag genuinely bad input.
  const invalid = rule.value.trim().length > 0 && !isValidRule(rule)

  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={rule.kind}
        aria-label="Match type"
        onChange={(event) => onPatch(rule.id, { kind: event.target.value as MatchKind })}
        className="w-36 shrink-0"
      >
        {MATCH_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {MATCH_KIND_LABELS[kind]}
          </option>
        ))}
      </Select>
      <Input
        value={rule.value}
        aria-label="Match value"
        spellCheck={false}
        placeholder={MATCH_KIND_HINTS[rule.kind]}
        onChange={(event) => onPatch(rule.id, { value: event.target.value })}
        className={cx('font-mono text-xs', invalid && 'border-red-500 dark:border-red-500')}
        title={invalid ? 'This pattern is not valid and will be skipped' : undefined}
      />
      <IconButton
        label={rule.enabled ? 'Mute rule' : 'Unmute rule'}
        onClick={() => onPatch(rule.id, { enabled: !rule.enabled })}
      >
        {rule.enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
      </IconButton>
      <IconButton
        label="Remove rule"
        onClick={() =>
          onChange((current) => ({ ...current, rules: current.rules.filter((item) => item.id !== rule.id) }))
        }
      >
        <X className="size-3.5" />
      </IconButton>
    </div>
  )
}

function BulkAdd({ onAdd }: { onAdd: (rules: Rule[]) => void }) {
  const [text, setText] = useState('')
  const entries = text
    .split(/[\s,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)

  return (
    <div className="space-y-2 rounded-md bg-zinc-50 p-2.5 dark:bg-zinc-800/50">
      <textarea
        value={text}
        autoFocus
        spellCheck={false}
        placeholder={'youtube.com\nnetflix.com\nspotify.com'}
        onChange={(event) => setText(event.target.value)}
        className="h-24 w-full resize-y rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          disabled={entries.length === 0}
          onClick={() => onAdd(entries.map((value) => makeRule({ kind: 'domain', value })))}
        >
          Add {entries.length || ''} {entries.length === 1 ? 'domain' : 'domains'}
        </Button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          One domain per line, or separated by commas.
        </span>
      </div>
    </div>
  )
}
