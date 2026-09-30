import { useCallback, useEffect, useState } from 'react'
import { Layers, Plus, Sparkles, X } from 'lucide-react'
import { sendMessage } from '../lib/messages.ts'
import type { Summary } from '../lib/organizer.ts'
import { groupFromTemplate, makeGroup } from '../lib/storage.ts'
import { TEMPLATES_BY_ID } from '../lib/templates.ts'
import type { Config, Group, Settings } from '../lib/types.ts'
import { Button, cx } from '../ui/components.tsx'
import { useConfig } from '../ui/useConfig.ts'
import { BackupPanel } from './BackupPanel.tsx'
import { GroupCard } from './GroupCard.tsx'
import { RuleTester } from './RuleTester.tsx'
import { SettingsPanel } from './SettingsPanel.tsx'
import { TemplateGallery } from './TemplateGallery.tsx'

const PANELS = ['Groups', 'Templates', 'Settings', 'Backup'] as const
type Panel = (typeof PANELS)[number]

export function Options() {
  const { config, update } = useConfig()
  const [panel, setPanel] = useState<Panel>('Groups')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setSummary(await sendMessage({ type: 'SUMMARY' }))
  }, [])

  // Editing a rule changes the config on every keystroke; coalesce those into
  // one recount instead of messaging the worker per character.
  useEffect(() => {
    if (!config) return
    const timer = setTimeout(() => void refresh(), 300)
    return () => clearTimeout(timer)
  }, [config, refresh])

  if (!config) return null

  const patchSettings = (patch: Partial<Settings>) =>
    update((previous) => ({ ...previous, settings: { ...previous.settings, ...patch } }))

  const patchGroup = (groupId: string, recipe: (group: Group) => Group) =>
    update((previous) => ({
      ...previous,
      groups: previous.groups.map((group) => (group.id === groupId ? recipe(group) : group)),
    }))

  const moveGroup = (index: number, direction: -1 | 1) =>
    update((previous) => {
      const groups = [...previous.groups]
      const target = index + direction
      const [moved] = groups.splice(index, 1)
      if (moved) groups.splice(target, 0, moved)
      return { ...previous, groups }
    })

  const addTemplate = (templateId: string) => {
    const template = TEMPLATES_BY_ID.get(templateId)
    if (!template) return
    update((previous) => ({ ...previous, groups: [...previous.groups, groupFromTemplate(template)] }))
    setStatus(`Added the ${template.name} group.`)
  }

  const organizeNow = async () => {
    const result = await sendMessage({ type: 'ORGANIZE_NOW' })
    setStatus(
      result.tabsMoved === 0
        ? 'Nothing to move — your tabs already match your groups.'
        : `Moved ${result.tabsMoved} tabs into ${result.groupsTouched} groups.`,
    )
    if (!config.onboarded) update((previous) => ({ ...previous, onboarded: true }))
    await refresh()
  }

  const countFor = (groupId: string) =>
    summary?.previews.find((preview) => preview.groupId === groupId)?.matching ?? 0

  const nameCounts = new Map<string, number>()
  for (const { name } of config.groups) {
    const key = name.trim().toLowerCase()
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
      <header className="flex flex-wrap items-center gap-3 py-6">
        <Layers className="size-6 text-indigo-600 dark:text-indigo-400" />
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Tab Organiser</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Your rules, your groups — stored in this browser only.
          </p>
        </div>
        <Button variant="primary" onClick={() => void organizeNow()}>
          <Sparkles className="size-4" />
          Organise now
        </Button>
      </header>

      {!config.onboarded ? (
        <Onboarding
          onOrganize={() => void organizeNow()}
          onBrowseTemplates={() => setPanel('Templates')}
          onDismiss={() => update((previous) => ({ ...previous, onboarded: true }))}
        />
      ) : null}

      <nav className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {PANELS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setPanel(name)}
            className={cx(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              panel === name
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
            )}
          >
            {name}
          </button>
        ))}
      </nav>

      {status ? (
        <p className="mt-3 rounded-md bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
          {status}
        </p>
      ) : null}

      <main className="mt-4 space-y-4">
        {panel === 'Groups' ? (
          <>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              A tab joins the group whose matching rule pins down the most of its URL, so a rule for
              <code className="mx-1 rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">instagram.com/you</code>
              beats one for <code className="mx-1 rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">instagram.com</code>
              wherever its group sits. Groups that match equally well fall back to this order — move one up to win ties.
            </p>
            {config.groups.map((group, index) => (
              <GroupCard
                key={group.id}
                group={group}
                matching={countFor(group.id)}
                isFirst={index === 0}
                isLast={index === config.groups.length - 1}
                duplicateName={(nameCounts.get(group.name.trim().toLowerCase()) ?? 0) > 1}
                onChange={(recipe) => patchGroup(group.id, recipe)}
                onMove={(direction) => moveGroup(index, direction)}
                onDelete={() =>
                  update((previous) => ({
                    ...previous,
                    groups: previous.groups.filter((candidate) => candidate.id !== group.id),
                  }))
                }
              />
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() =>
                  update((previous) => ({ ...previous, groups: [...previous.groups, makeGroup()] }))
                }
              >
                <Plus className="size-3.5" />
                New group
              </Button>
              <Button variant="ghost" onClick={() => setPanel('Templates')}>
                Or start from a template
              </Button>
              {summary && summary.unmatched > 0 ? (
                <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
                  {summary.unmatched} open {summary.unmatched === 1 ? 'tab matches' : 'tabs match'} no group
                </span>
              ) : null}
            </div>
            <RuleTester groups={config.groups} />
          </>
        ) : null}

        {panel === 'Templates' ? <TemplateGallery groups={config.groups} onAdd={addTemplate} /> : null}
        {panel === 'Settings' ? <SettingsPanel settings={config.settings} onChange={patchSettings} /> : null}
        {panel === 'Backup' ? (
          <BackupPanel config={config} onReplace={(next: Config) => update(() => next)} />
        ) : null}
      </main>
    </div>
  )
}

function Onboarding({
  onOrganize,
  onBrowseTemplates,
  onDismiss,
}: {
  onOrganize: () => void
  onBrowseTemplates: () => void
  onDismiss: () => void
}) {
  return (
    <section className="relative mb-5 rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="absolute top-2 right-2 rounded p-1 text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900"
      >
        <X className="size-4" />
      </button>
      <h2 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">You&rsquo;re set up</h2>
      <p className="mt-1 max-w-2xl text-xs text-indigo-800/80 dark:text-indigo-200/80">
        Four groups are ready to go: Social, Entertainment, Work and Dev. Add more from the templates, or write your
        own rules below. When you&rsquo;re happy, sort the tabs you already have open.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" onClick={onOrganize}>
          <Sparkles className="size-4" />
          Organise my open tabs
        </Button>
        <Button onClick={onBrowseTemplates}>Browse templates</Button>
      </div>
    </section>
  )
}
