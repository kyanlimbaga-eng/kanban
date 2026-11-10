import type { Priority } from '../../types'
import { cn } from '../../utils/cn'
import { PRIORITY_LABELS } from '../../utils/priority'

const badgeStyles: Record<Priority, string> = {
  low: 'bg-[color:rgb(47_111_104/0.1)] text-[#275c56] ring-[color:rgb(47_111_104/0.18)] dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  medium:
    'bg-[color:rgb(138_106_47/0.1)] text-[#725621] ring-[color:rgb(138_106_47/0.18)] dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20',
  high: 'bg-[color:rgb(180_83_60/0.1)] text-[#8a3d2d] ring-[color:rgb(180_83_60/0.18)] dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20',
}

const dotStyles: Record<Priority, string> = {
  low: 'bg-[var(--color-signal)] dark:bg-emerald-500',
  medium: 'bg-[#8a6a2f] dark:bg-amber-500',
  high: 'bg-[var(--color-alert)] dark:bg-rose-500',
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
