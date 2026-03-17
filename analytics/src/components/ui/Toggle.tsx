'use client'
import { clsx } from 'clsx'

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  disabled?: boolean
  size?: 'sm' | 'md'
}

export default function Toggle({ checked, onChange, label, disabled, size = 'md' }: ToggleProps) {
  const sm = size === 'sm'
  return (
    <label className={clsx('flex items-center gap-2 cursor-pointer', disabled && 'opacity-50 cursor-not-allowed')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={clsx(
          'relative inline-flex shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          sm ? 'h-4 w-7' : 'h-5 w-9',
          checked ? 'bg-accent' : 'bg-white/15'
        )}
      >
        <span
          className={clsx(
            'inline-block rounded-full bg-white shadow-sm transform transition-transform duration-200',
            sm ? 'h-3 w-3 m-0.5' : 'h-4 w-4 m-0.5',
            checked ? (sm ? 'translate-x-3' : 'translate-x-4') : 'translate-x-0'
          )}
        />
      </button>
      {label && <span className="text-sm text-gray-300">{label}</span>}
    </label>
  )
}
