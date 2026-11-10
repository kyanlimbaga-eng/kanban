import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerGhost'
type ButtonSize = 'sm' | 'md' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-signal)] text-[#fffefb] hover:brightness-110 active:brightness-95',
  secondary:
    'border border-[var(--color-rail)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[#f0ede6] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white',
  ghost:
    'text-[color:rgb(31_41_51/0.75)] hover:bg-[var(--color-rail)]/60 hover:text-[var(--color-ink)] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  danger:
    'bg-[var(--color-alert)] text-[#fffefb] hover:brightness-110 active:brightness-95',
  dangerGhost:
    'text-[var(--color-alert)] hover:bg-[var(--color-alert)]/10 hover:brightness-95 dark:text-rose-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-300',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-2.5 text-xs',
  md: 'h-9 gap-2 px-3.5 text-sm',
  icon: 'h-9 w-9',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-signal)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-paper)] dark:focus-visible:ring-indigo-500/70 dark:focus-visible:ring-offset-slate-900',
        'disabled:pointer-events-none disabled:opacity-50',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    />
  )
}
