import type { ComponentProps, ReactNode } from 'react'
import { GROUP_COLORS, type GroupColor } from '../lib/types.ts'
import { COLOR_SWATCH } from './colors.ts'

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-600/50',
  secondary:
    'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
  ghost: 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
  danger: 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50',
}

export function Button({
  variant = 'secondary',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  )
}

export function IconButton({ label, className, ...props }: ComponentProps<'button'> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cx(
        'inline-flex size-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
        className,
      )}
      {...props}
    />
  )
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cx(
        'w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-600',
        className,
      )}
      {...props}
    />
  )
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cx(
        'rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900',
        className,
      )}
      {...props}
    />
  )
}

/** A small switch. Rendered as a real checkbox so it stays keyboard-operable. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: ReactNode
  description?: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="block h-5 w-9 rounded-full bg-zinc-300 transition-colors peer-checked:bg-indigo-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-500 dark:bg-zinc-700" />
        <span className="pointer-events-none absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description ? (
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">{description}</span>
        ) : null}
      </span>
    </label>
  )
}

export function ColorDot({ color, className }: { color: GroupColor; className?: string }) {
  return <span className={cx('inline-block size-2.5 shrink-0 rounded-full', COLOR_SWATCH[color], className)} />
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: GroupColor
  onChange: (color: GroupColor) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {GROUP_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          title={color}
          aria-label={color}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
          className={cx(
            'size-5 rounded-full transition-transform hover:scale-110',
            COLOR_SWATCH[color],
            value === color && 'ring-2 ring-zinc-900 ring-offset-2 dark:ring-white dark:ring-offset-zinc-950',
          )}
        />
      ))}
    </div>
  )
}

/** "1 tab" / "2 tabs" — the only pluralisation the UI needs. */
export const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

export { cx }
