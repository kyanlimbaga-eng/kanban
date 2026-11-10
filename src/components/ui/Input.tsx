import type {
  ComponentPropsWithRef,
  ReactNode,
} from 'react'
import { cn } from '../../utils/cn'

const fieldStyles =
  'w-full rounded-md border border-[var(--color-rail)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none transition placeholder:text-[color:rgb(31_41_51/0.4)] hover:border-[#cfc9bc] focus:border-[var(--color-signal)] focus:ring-2 focus:ring-[var(--color-signal)]/20 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20'

export function Input({
  className,
  ...props
}: ComponentPropsWithRef<'input'>) {
  return <input className={cn(fieldStyles, className)} {...props} />
}

export function Textarea({
  className,
  ...props
}: ComponentPropsWithRef<'textarea'>) {
  return (
    <textarea
      className={cn(fieldStyles, 'resize-y leading-relaxed', className)}
      {...props}
    />
  )
}

export function Select({
  className,
  ...props
}: ComponentPropsWithRef<'select'>) {
  return (
    <select
      className={cn(fieldStyles, 'cursor-pointer pr-8', className)}
      {...props}
    />
  )
}

interface FieldProps {
  label: string
  htmlFor: string
  children: ReactNode
  hint?: string
  error?: string
  className?: string
}

export function Field({
  label,
  htmlFor,
  children,
  hint,
  error,
  className,
}: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className="text-xs font-medium text-[color:rgb(31_41_51/0.75)] dark:text-slate-400"
        >
          {label}
        </label>
        {hint && (
          <span
            className={cn(
              'text-[11px] text-[color:rgb(31_41_51/0.5)] dark:text-slate-500',
              error && 'text-[var(--color-alert)] dark:text-rose-400',
            )}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
      {error && (
        <p className="text-xs text-[var(--color-alert)] dark:text-rose-400">{error}</p>
      )}
    </div>
  )
}
