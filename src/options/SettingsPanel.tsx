import type { Scope, Settings } from '../lib/types.ts'
import { Select, Toggle } from '../ui/components.tsx'

export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}) {
  return (
    <div className="max-w-xl space-y-5 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <Toggle
        checked={settings.autoOrganize}
        onChange={(autoOrganize) => onChange({ autoOrganize })}
        label="Auto-organise new tabs"
        description="Sort a tab into its group as soon as it finishes loading."
      />
      <Toggle
        checked={settings.organizeOnStartup}
        onChange={(organizeOnStartup) => onChange({ organizeOnStartup })}
        label="Organise on browser startup"
        description="Run a full sweep over restored tabs when Chrome opens."
      />
      <Toggle
        checked={settings.moveMismatched}
        onChange={(moveMismatched) => onChange({ moveMismatched })}
        label="Move tabs that no longer fit"
        description="If a tab in one of your groups navigates elsewhere, move it to the group that now matches. Groups you made by hand in Chrome are never touched."
      />
      <Toggle
        checked={settings.ungroupUnmatched}
        onChange={(ungroupUnmatched) => onChange({ ungroupUnmatched })}
        label="Release tabs that match nothing"
        description="Pull a tab out of your group when no rule matches it any more."
      />
      <Toggle
        checked={settings.includePinned}
        onChange={(includePinned) => onChange({ includePinned })}
        label="Include pinned tabs"
        description="Off by default — pinned tabs are usually deliberate."
      />

      <label className="flex items-center justify-between gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <span>
          <span className="block text-sm font-medium">Default scope</span>
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
            Which windows &ldquo;Organise now&rdquo; sweeps.
          </span>
        </span>
        <Select
          value={settings.scope}
          onChange={(event) => onChange({ scope: event.target.value as Scope })}
        >
          <option value="currentWindow">This window</option>
          <option value="allWindows">All windows</option>
        </Select>
      </label>
    </div>
  )
}
