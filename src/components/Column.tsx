import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CSSProperties } from 'react'
import type {
  Card as CardModel,
  Column as ColumnModel,
  DragType,
} from '../types'
import { cn } from '../utils/cn'
import { Card } from './Card'
import {
  GripVerticalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from './ui/icons'
import { IconButton } from './ui/IconButton'

interface ColumnProps {
  column: ColumnModel
  cards: CardModel[]
  totalCardCount: number
  isFiltered: boolean
  dragType: DragType
  accentClass: string
  onOpenCard: (id: string) => void
  onAddCard: (columnId: string) => void
  onRenameColumn: (column: ColumnModel) => void
  onDeleteColumn: (column: ColumnModel) => void
}

export function Column({
  column,
  cards,
  totalCardCount,
  isFiltered,
  dragType,
  accentClass,
  onOpenCard,
  onAddCard,
  onRenameColumn,
  onDeleteColumn,
}: ColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: { type: 'column' },
  })

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `card-drop-${column.id}`,
    data: { type: 'card-drop', columnId: column.id },
  })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const totalLabel = `${totalCardCount} ${
    totalCardCount === 1 ? 'card' : 'cards'
  }`
  const showingFiltered = isFiltered && cards.length !== totalCardCount
  const filteredEmpty = isFiltered && totalCardCount > 0 && cards.length === 0

  return (
    <section
      ref={setNodeRef}
      style={style}
      aria-labelledby={`column-title-${column.id}`}
      className={cn(
        'flex h-full min-w-0 flex-col overflow-hidden rounded-md border border-[var(--color-rail)] bg-[color:rgb(231_227_218/0.45)] transition-[box-shadow,border-color,opacity]',
        'dark:border-slate-800 dark:bg-slate-900/70',
        isDragging && 'relative z-20 opacity-90 shadow-2xl ring-2 ring-indigo-400/70',
        dragType === 'column' && isOver && 'ring-2 ring-indigo-400/50',
      )}
    >
      <header className="flex items-center gap-2 border-b border-[var(--color-rail)] px-3 pt-3 pb-2.5 dark:border-slate-800">
        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-[2px]', accentClass)} />
        <h2
          id={`column-title-${column.id}`}
          title={column.title}
          className="min-w-0 flex-1 truncate font-serif text-[1.2rem] font-semibold leading-none tracking-tight text-[var(--color-ink)] dark:text-slate-200"
        >
          {column.title}
        </h2>
        <span
          className="shrink-0 rounded-sm border border-[var(--color-rail)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[color:rgb(31_41_51/0.7)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
          title={
            showingFiltered
              ? `${cards.length} of ${totalLabel} match the filters`
              : totalLabel
          }
        >
          {showingFiltered ? `${cards.length}/${totalCardCount}` : totalCardCount}
        </span>
        <div className="-mr-1 flex items-center">
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${column.title} column`}
            title="Drag to reorder column"
            className="inline-flex h-7 w-7 cursor-grab touch-manipulation items-center justify-center rounded-md text-[color:rgb(31_41_51/0.45)] transition-colors select-none [-webkit-touch-callout:none] hover:bg-[var(--color-rail)]/70 hover:text-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-signal)]/60 focus-visible:outline-none active:cursor-grabbing dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 dark:focus-visible:ring-indigo-500/70"
          >
            <GripVerticalIcon className="h-4 w-4" />
          </button>
          <IconButton
            label={`Rename ${column.title} column`}
            onClick={() => onRenameColumn(column)}
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            label={`Delete ${column.title} column`}
            tone="danger"
            onClick={() => onDeleteColumn(column)}
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </header>

      <div
        ref={setDroppableRef}
        className={cn(
          'scrollbar-slim flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-2.5 pb-2 transition-colors',
          dragType === 'card' &&
            isOver &&
            'bg-[var(--color-signal)]/8 dark:bg-indigo-500/5',
        )}
      >
        <SortableContext
          items={cards.map((card) => card.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.length === 0 ? (
            <div
              className={cn(
                'm-0.5 flex flex-1 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-6 text-center transition-colors',
                dragType === 'card' && isOver
                  ? 'border-[var(--color-signal)]/50 bg-[var(--color-signal)]/8 dark:border-indigo-500/60 dark:bg-indigo-500/5'
                  : 'border-[color:rgb(31_41_51/0.22)] dark:border-slate-700/80',
              )}
            >
              {filteredEmpty ? (
                <SearchIcon className="h-5 w-5 text-[color:rgb(31_41_51/0.45)] dark:text-slate-500" />
              ) : (
                <PlusIcon className="h-5 w-5 text-[color:rgb(31_41_51/0.45)] dark:text-slate-500" />
              )}
              <p className="text-xs font-medium text-[color:rgb(31_41_51/0.7)] dark:text-slate-400">
                {filteredEmpty ? 'No matching cards' : 'No cards yet'}
              </p>
              <p className="max-w-[26ch] text-[11px] leading-relaxed text-[color:rgb(31_41_51/0.5)] dark:text-slate-500">
                {filteredEmpty
                  ? 'Try a different search or clear the filters.'
                  : 'Drop a card here or add one below.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 p-0.5">
              {cards.map((card) => (
                <Card key={card.id} card={card} onOpen={onOpenCard} />
              ))}
            </div>
          )}
        </SortableContext>
      </div>

      <div className="shrink-0 border-t border-[var(--color-rail)] p-2 pt-2 dark:border-slate-800">
        <button
          type="button"
          onClick={() => onAddCard(column.id)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[color:rgb(31_41_51/0.2)] px-2 py-2 text-xs font-medium text-[color:rgb(31_41_51/0.7)] transition-colors hover:border-[var(--color-signal)]/40 hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-signal)]/60 focus-visible:outline-none dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:focus-visible:ring-indigo-500/70"
        >
          <PlusIcon className="h-4 w-4" />
          Add card
        </button>
      </div>
    </section>
  )
}
