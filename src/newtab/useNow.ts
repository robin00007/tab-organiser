import { useEffect, useState } from 'react'
import { msUntilNextMinute } from '../lib/greeting.ts'

/**
 * The current time, refreshed only when the minute changes — the page shows no
 * seconds, so a one-second interval would be 59 wasted renders out of 60.
 *
 * Browsers throttle timers in background tabs, so the time is also re-read the
 * moment the tab becomes visible instead of showing whatever it was when hidden.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const tick = () => {
      setNow(new Date())
      // Recomputed every time, so a timer that fires a hair early corrects itself.
      timer = setTimeout(tick, msUntilNextMinute(Date.now()))
    }
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      clearTimeout(timer)
      tick()
    }

    timer = setTimeout(tick, msUntilNextMinute(Date.now()))
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return now
}
