import type { Priority } from '../../types'
import { cn } from '../../utils/cn'
import { PRIORITY_LABELS } from '../../utils/priority'

const badgeStyles: Record<Priority, string> = {
  low: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  medium:
    'bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20',
  high: 'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20',
}

const dotStyles: Record<Priority, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-rose-500',
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        badgeStyles[priority],
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dotStyles[priority])} />
      {PRIORITY_LABELS[priority]}
    </span>
  )
}
