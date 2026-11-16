import type { ClockMode, TimeOfDay } from './types.ts'

/**
 * One definition of "morning" for the whole page: the greeting and the
 * background both read it, so they can never disagree.
 */
export function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

const GREETINGS: Record<TimeOfDay, string> = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
  night: 'Good night',
}

export function greeting(hour: number, name: string): string {
  const who = name.trim()
  const hello = GREETINGS[timeOfDay(hour)]
  return who ? `${hello}, ${who}` : hello
}

export interface ClockParts {
  /** `9:05` or `09:05`, without any AM/PM marker. */
  time: string
  /** `AM`/`PM` where the clock is 12-hour, otherwise empty. */
  period: string
}

/**
 * The time split in two so the page can set the AM/PM marker small next to the
 * big digits. `hourCycle` is used rather than `hour12: false`, which prints
 * midnight as `24:05` in some locales.
 */
export function clockParts(date: Date, mode: ClockMode, locale?: string): ClockParts {
  const formatter = new Intl.DateTimeFormat(locale, {
    // A 24-hour clock reads as `09:05`, a 12-hour one as `9:05`.
    hour: mode === '24h' ? '2-digit' : 'numeric',
    minute: '2-digit',
    ...(mode === 'auto' ? {} : { hourCycle: mode === '24h' ? 'h23' : 'h12' }),
  })

  let time = ''
  let period = ''
  let sawMinute = false
  for (const part of formatter.formatToParts(date)) {
    if (part.type === 'dayPeriod') period = part.value
    else if (part.type === 'hour') time += part.value
    else if (part.type === 'minute') {
      time += part.value
      sawMinute = true
    } else if (part.type === 'literal' && !sawMinute) time += part.value
  }
  return { time, period }
}

export function dateLine(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
}

/** Milliseconds until the clock's minute digit next changes. */
export const msUntilNextMinute = (nowMs: number): number => 60_000 - (nowMs % 60_000)
