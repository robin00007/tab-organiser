import type { GroupColor } from '../lib/types.ts'

/** Tailwind classes keyed by Chrome's tab-group colour names. */
export const COLOR_SWATCH: Record<GroupColor, string> = {
  grey: 'bg-tg-grey',
  blue: 'bg-tg-blue',
  red: 'bg-tg-red',
  yellow: 'bg-tg-yellow',
  green: 'bg-tg-green',
  pink: 'bg-tg-pink',
  purple: 'bg-tg-purple',
  cyan: 'bg-tg-cyan',
  orange: 'bg-tg-orange',
}
