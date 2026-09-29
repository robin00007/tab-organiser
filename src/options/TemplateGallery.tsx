import { Check, Plus } from 'lucide-react'
import { TEMPLATES } from '../lib/templates.ts'
import type { Group } from '../lib/types.ts'
import { Button, ColorDot } from '../ui/components.tsx'

/**
 * Starter packs. A template is "added" purely by name, so a user who renames
 * the group gets the card offered again — which is the honest answer, since
 * we can no longer tell whether their group came from here.
 */
export function TemplateGallery({
  groups,
  onAdd,
}: {
  groups: Group[]
  onAdd: (templateId: string) => void
}) {
  const existing = new Set(groups.map((group) => group.name.trim().toLowerCase()))

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {TEMPLATES.map((template) => {
        const added = existing.has(template.name.toLowerCase())
        return (
          <article
            key={template.id}
            className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <header className="flex items-center gap-2">
              <ColorDot color={template.color} />
              <h3 className="flex-1 font-medium">{template.name}</h3>
              <span className="text-xs text-zinc-400 tabular-nums">{template.domains.length}</span>
            </header>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{template.blurb}</p>
            <p className="line-clamp-2 font-mono text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
              {template.domains.slice(0, 5).join(' · ')}
            </p>
            <Button
              variant={added ? 'ghost' : 'secondary'}
              disabled={added}
              className="mt-auto w-full"
              onClick={() => onAdd(template.id)}
            >
              {added ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
              {added ? 'Added' : 'Add group'}
            </Button>
          </article>
        )
      })}
    </div>
  )
}
