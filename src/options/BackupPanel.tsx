import { useRef, useState } from 'react'
import { Download, RotateCcw, Upload } from 'lucide-react'
import { defaultConfig, parseConfig } from '../lib/storage.ts'
import type { Config } from '../lib/types.ts'
import { Button } from '../ui/components.tsx'

export function BackupPanel({
  config,
  onReplace,
}: {
  config: Config
  onReplace: (config: Config) => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState<string | null>(null)

  const download = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `tab-organiser-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    // Revoking immediately can race the download in Chrome; one turn is enough.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const importFile = async (file: File) => {
    try {
      const imported = parseConfig(JSON.parse(await file.text()))
      onReplace({ ...imported, onboarded: true })
      setNote(`Imported ${imported.groups.length} groups.`)
    } catch {
      setNote('That file could not be read as a Tab Organiser backup.')
    }
  }

  return (
    <div className="max-w-xl space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Your groups live only in this browser profile. Export a file to move them to another machine or to keep a
        copy before a big edit.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={download}>
          <Download className="size-3.5" />
          Export JSON
        </Button>
        <Button onClick={() => fileInput.current?.click()}>
          <Upload className="size-3.5" />
          Import JSON
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            if (!confirm('Replace all groups and settings with the defaults?')) return
            onReplace({ ...defaultConfig(), onboarded: true })
            setNote('Reset to the default groups.')
          }}
        >
          <RotateCcw className="size-3.5" />
          Reset to defaults
        </Button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void importFile(file)
          event.target.value = ''
        }}
      />
      {note ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{note}</p> : null}
    </div>
  )
}
