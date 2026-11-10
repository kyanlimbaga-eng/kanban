import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  tone?: 'default' | 'danger'
}

export function IconButton({
  label,
  tone = 'default',
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
        'focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-200 focus-visible:outline-none dark:focus-visible:ring-offset-slate-900',
        tone === 'danger'
          ? 'text-slate-400 hover:bg-rose-100/70 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-300'
          : 'text-slate-400 hover:bg-slate-300/60 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200',
        className,
      )}
      {...props}
    />
  )
}
