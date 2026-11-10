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

      <h3 className="line-clamp-3 pr-6 font-serif text-[1rem] leading-snug font-semibold text-[var(--color-ink)] dark:text-slate-100">
        {card.title}
      </h3>

      {card.description && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[color:rgb(31_41_51/0.68)] dark:text-slate-400">
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
                ? 'text-[var(--color-alert)] dark:text-rose-400'
                : dueToday
                  ? 'text-[#8a6a2f] dark:text-amber-400'
                  : 'text-[color:rgb(31_41_51/0.6)] dark:text-slate-400',
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
            className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-signal)]/12 text-[10px] font-semibold text-[var(--color-signal)] ring-1 ring-[var(--color-rail)] dark:bg-indigo-500/20 dark:text-indigo-300 dark:ring-slate-800"
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
  readOnly?: boolean
}

export function Card({ card, onOpen, readOnly = false }: CardProps) {
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
    disabled: readOnly,
  })

  const style: CSSProperties = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!readOnly) {
      listeners?.onKeyDown?.(event)
    }
    if (!event.defaultPrevented && event.key === 'Enter') {
      event.preventDefault()
      onOpen(card.id)
    }
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...(readOnly ? {} : attributes)}
      {...(readOnly ? {} : listeners)}
      onKeyDown={handleKeyDown}
      onClick={() => onOpen(card.id)}
      aria-label={
        readOnly
          ? `${card.title}. Press Enter to view details.`
          : `${card.title}. Press Enter to edit or Space to drag.`
      }
      className={cn(
        'group relative rounded-sm border border-[var(--color-rail)] bg-[var(--color-surface)] p-3 shadow-[0_1px_0_rgba(31,41,51,0.04)] ring-1 ring-transparent transition-[box-shadow,border-color,opacity,transform] select-none [-webkit-touch-callout:none]',
        'hover:border-[#cfc9bc] hover:shadow-[0_6px_16px_rgba(31,41,51,0.08)] focus-visible:ring-2 focus-visible:ring-[var(--color-signal)]/50 focus-visible:outline-none',
        readOnly ? 'cursor-pointer' : 'cursor-grab touch-manipulation active:cursor-grabbing',
        'dark:border-slate-700/80 dark:bg-slate-800/90 dark:hover:border-slate-600 dark:focus-visible:ring-indigo-500/60',
        isDragging && 'opacity-40',
      )}
    >
      {!readOnly && (
        <button
          type="button"
          aria-label={`Edit ${card.title}`}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onOpen(card.id)
          }}
          className="absolute top-2 right-2 rounded-md p-1 text-[color:rgb(31_41_51/0.45)] opacity-0 transition hover:bg-[var(--color-rail)]/60 hover:text-[var(--color-ink)] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--color-signal)]/60 focus-visible:outline-none group-hover:opacity-100 group-focus-within:opacity-100 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 dark:focus-visible:ring-indigo-500"
        >
          <PencilIcon className="h-3.5 w-3.5" />
        </button>
      )}
      <CardContent card={card} />
    </article>
  )
}

export function CardPreview({ card }: { card: CardModel }) {
  return (
    <div className="w-[min(84vw,300px)] rotate-1 cursor-grabbing rounded-sm border border-[var(--color-signal)]/40 bg-[var(--color-surface)] p-3 shadow-[0_18px_40px_rgba(31,41,51,0.2)] ring-1 ring-[var(--color-signal)]/20 sm:w-[300px] dark:border-indigo-500/40 dark:bg-slate-800 dark:ring-indigo-400/40 dark:shadow-2xl">
      <CardContent card={card} />
    </div>
  )
}
