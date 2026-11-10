import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { Card as CardModel } from '../types'
import { cn } from '../utils/cn'
import { formatDueDate, isDueToday, isOverdue } from '../utils/dates'
import { getLabelClasses } from '../utils/labels'
import { CalendarIcon, PencilIcon } from './ui/icons'
import { PriorityBadge } from './ui/PriorityBadge'

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function CardContent({ card }: { card: CardModel }) {
  const overdue = isOverdue(card.dueDate)
  const dueToday = isDueToday(card.dueDate)
  const visibleLabels = card.labels.slice(0, 3)
  const hiddenLabelCount = card.labels.length - visibleLabels.length

  return (
    <>
      {card.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1 pr-6" title={card.labels.join(', ')}>
          {visibleLabels.map((label) => (
            <span
              key={label}
              className={cn(
                'max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset',
                getLabelClasses(label),
              )}
            >
              {label}
            </span>
          ))}
          {hiddenLabelCount > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
              +{hiddenLabelCount}
            </span>
          )}
        </div>
      )}

      <h3 className="line-clamp-3 pr-6 text-sm leading-snug font-medium text-slate-900 dark:text-slate-100">
        {card.title}
      </h3>

      {card.description && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {card.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PriorityBadge priority={card.priority} />
        {card.dueDate && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[11px] font-medium whitespace-nowrap',
              overdue
                ? 'text-rose-600 dark:text-rose-400'
                : dueToday
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-500 dark:text-slate-400',
            )}
            title={`Due ${card.dueDate}`}
          >
            <CalendarIcon className="h-3 w-3" />
            {overdue
              ? `Overdue · ${formatDueDate(card.dueDate)}`
              : formatDueDate(card.dueDate)}
          </span>
        )}
        {card.assignee && (
          <span
            className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700 ring-2 ring-white dark:bg-indigo-500/20 dark:text-indigo-300 dark:ring-slate-800"
            title={`Assigned to ${card.assignee}`}
          >
            {getInitials(card.assignee)}
            <span className="sr-only">Assigned to {card.assignee}</span>
          </span>
        )}
      </div>
    </>
  )
}

interface CardProps {
  card: CardModel
  onOpen: (id: string) => void
}

export function Card({ card, onOpen }: CardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: 'card', columnId: card.columnId },
  })

  const style: CSSProperties = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    listeners?.onKeyDown?.(event)
    // Enter opens the editor; Space is reserved for picking the card up.
    if (!event.defaultPrevented && event.key === 'Enter') {
      event.preventDefault()
      onOpen(card.id)
    }
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onKeyDown={handleKeyDown}
      onClick={() => onOpen(card.id)}
      aria-label={`${card.title}. Press Enter to edit or Space to drag.`}
      className={cn(
        'group relative cursor-grab touch-manipulation rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-transparent transition-[box-shadow,border-color,opacity] select-none [-webkit-touch-callout:none]',
        'hover:border-slate-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:outline-none active:cursor-grabbing',
        'dark:border-slate-700/80 dark:bg-slate-800/90 dark:hover:border-slate-600',
        isDragging && 'opacity-40',
      )}
    >
      <button
        type="button"
        aria-label={`Edit ${card.title}`}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onOpen(card.id)
        }}
        className="absolute top-2 right-2 rounded-md p-1 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none group-hover:opacity-100 group-focus-within:opacity-100 dark:hover:bg-slate-700 dark:hover:text-slate-200"
      >
        <PencilIcon className="h-3.5 w-3.5" />
      </button>
      <CardContent card={card} />
    </article>
  )
}

export function CardPreview({ card }: { card: CardModel }) {
  return (
    <div className="w-[min(84vw,300px)] rotate-2 cursor-grabbing rounded-xl border border-indigo-300 bg-white p-3 shadow-2xl ring-2 ring-indigo-400/40 sm:w-[300px] dark:border-indigo-500/40 dark:bg-slate-800">
      <CardContent card={card} />
    </div>
  )
}
