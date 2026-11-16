import { Settings } from 'lucide-react'
import { greeting, timeOfDay } from '../lib/greeting.ts'
import { cx } from '../ui/components.tsx'
import { useConfig } from '../ui/useConfig.ts'
import { Background } from './Background.tsx'
import { Clock } from './Clock.tsx'
import { SearchBar } from './SearchBar.tsx'
import { useNow } from './useNow.ts'

export function NewTab() {
  const { config } = useConfig()
  const now = useNow()

  const settings = config?.settings
  const scene = !settings || settings.scene === 'auto' ? timeOfDay(now.getHours()) : settings.scene

  return (
    <>
      <Background scene={scene} />

      <main className="relative z-10 flex min-h-screen flex-col items-center px-6 pt-[12vh] pb-16 text-white">
        {/* Held back until the settings arrive, so a saved name or 24-hour clock
            never flashes in as the default first. */}
        <header
          className={cx(
            'flex flex-col items-center text-center transition-opacity duration-700',
            settings ? 'opacity-100' : 'opacity-0',
          )}
        >
          <Clock now={now} mode={settings?.clock ?? 'auto'} />
          <h1 className="glow-text mt-8 text-3xl font-light sm:text-4xl">
            {greeting(now.getHours(), settings?.userName ?? '')}
          </h1>
        </header>

        <div className="mt-10 w-full max-w-2xl">
          <SearchBar />
        </div>
      </main>

      <button
        type="button"
        title="Settings"
        aria-label="Settings"
        onClick={() => void chrome.runtime.openOptionsPage()}
        className="fixed right-4 bottom-4 z-10 rounded-full p-2.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Settings className="size-5" />
      </button>
    </>
  )
}
