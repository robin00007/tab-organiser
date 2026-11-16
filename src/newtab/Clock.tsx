import { clockParts, dateLine } from '../lib/greeting.ts'
import type { ClockMode } from '../lib/types.ts'

export function Clock({ now, mode }: { now: Date; mode: ClockMode }) {
  const { time, period } = clockParts(now, mode)

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-start justify-center gap-3 leading-none">
        <time
          dateTime={now.toISOString()}
          className="glow-text text-[clamp(5.5rem,17vw,12rem)] leading-[0.9] font-extralight tracking-tight tabular-nums"
        >
          {time}
        </time>
        {period ? (
          <span className="glow-text mt-[clamp(0.75rem,3vw,2.25rem)] text-[clamp(1.25rem,3.2vw,2.25rem)] font-light text-white/80">
            {period}
          </span>
        ) : null}
      </div>
      <p className="glow-text mt-3 text-xl font-light tracking-wide text-white/80">{dateLine(now)}</p>
    </div>
  )
}
