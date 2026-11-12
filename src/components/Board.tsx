import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardCode,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type {
  CollisionDetection,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useBoardStore } from '../store/boardStore'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import type {
  Card as CardModel,
  Column as ColumnModel,
  DragType,
} from '../types'
import { canMoveCard } from '../utils/access'
import { sortByPosition } from '../utils/array'
import { cardMatchesFilters, hasActiveFilters } from '../utils/filters'
import { normalizeLabels } from '../utils/labels'
import { AppHeader } from './AppHeader'
import { BoardEmptyState } from './BoardEmptyState'
import { CardModal } from './CardModal'
import { CardPreview } from './Card'
import { Column } from './Column'
import { ColumnModal } from './ColumnModal'
import { FilterBar } from './FilterBar'
import { SettingsModal } from './SettingsModal'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { Toast } from './ui/Toast'
import type { ToastMessage } from './ui/Toast'

const COLUMN_ACCENTS = [
  'bg-[var(--color-signal)]',
  'bg-[#8a6a2f]',
  'bg-[#5b6f7a]',
  'bg-[#6b7c5a]',
  'bg-[var(--color-alert)]',
  'bg-[#6f6778]',
]

type CardModalState =
  | { mode: 'create'; columnId: string }
  | { mode: 'edit'; cardId: string }
  | null

type ColumnDialogState =
  | { mode: 'add' }
  | { mode: 'rename'; columnId: string }
  | null

type ActiveDrag =
  | { type: 'card'; id: string }
  | { type: 'column'; id: string }
  | null

const boardCollisionDetection: CollisionDetection = (args) => {
  const activeType = args.active.data.current?.type
  const containers = args.droppableContainers.filter((container) => {
    const type = container.data.current?.type
    return activeType === 'column'
      ? type === 'column'
      : type === 'card' || type === 'card-drop'
  })
  const filteredArgs = { ...args, droppableContainers: containers }
  const pointerCollisions = pointerWithin(filteredArgs)
  if (pointerCollisions.length > 0) return pointerCollisions
  return closestCorners(filteredArgs)
}

interface BoardProps {
  readOnly: boolean
}

export function Board({ readOnly }: BoardProps) {
  const columns = useBoardStore((state) => state.columns)
  const cards = useBoardStore((state) => state.cards)
  const boardLabels = useBoardStore((state) => state.labels)
  const currentUser = useAuthStore((state) => state.user)
  const addColumn = useBoardStore((state) => state.addColumn)
  const renameColumn = useBoardStore((state) => state.renameColumn)
  const deleteColumn = useBoardStore((state) => state.deleteColumn)
  const reorderColumn = useBoardStore((state) => state.reorderColumn)
  const moveCard = useBoardStore((state) => state.moveCard)

  const filters = useUiStore((state) => state.filters)
  const setSearch = useUiStore((state) => state.setSearch)
  const setPriorityFilter = useUiStore((state) => state.setPriorityFilter)
  const setLabelFilter = useUiStore((state) => state.setLabelFilter)
  const clearFilters = useUiStore((state) => state.clearFilters)

  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null)
  const [cardModal, setCardModal] = useState<CardModalState>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [columnDialog, setColumnDialog] = useState<ColumnDialogState>(null)
  const [columnToDelete, setColumnToDelete] = useState<ColumnModel | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const suppressClickRef = useRef(false)
  const boardRef = useRef<HTMLElement>(null)

  const sensors = useSensors(
    // Sensors stay enabled for every role: whether a card can actually be
    // dragged is decided per card (see Card.tsx), while columns remain
    // admin-only through their own disabled sortable.
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: {
        start: [KeyboardCode.Space],
        cancel: [KeyboardCode.Esc],
        end: [KeyboardCode.Space, KeyboardCode.Tab],
      },
    }),
  )

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(
      () => setToast(null),
      toast.tone === 'error' ? 5500 : 3500,
    )
    return () => window.clearTimeout(timeout)
  }, [toast])

  const orderedColumns = useMemo(
    () => [...columns].sort((first, second) => first.order - second.order),
    [columns],
  )

  const labelOptions = useMemo(
    () =>
      normalizeLabels([
        ...boardLabels,
        ...cards.flatMap((card) => card.labels),
      ]).sort((first, second) => first.localeCompare(second)),
    [boardLabels, cards],
  )

  useEffect(() => {
    if (filters.label !== null && !labelOptions.includes(filters.label)) {
      setLabelFilter(null)
    }
  }, [filters.label, labelOptions, setLabelFilter])

  const { cardsByColumn, totalCardsByColumn } = useMemo(() => {
    const grouped = new Map<string, CardModel[]>()
    for (const column of orderedColumns) {
      grouped.set(column.id, [])
    }
    for (const card of cards) {
      grouped.get(card.columnId)?.push(card)
    }

    const totals = new Map<string, number>()
    const visible = new Map<string, CardModel[]>()
    for (const [columnId, columnCards] of grouped) {
      totals.set(columnId, columnCards.length)
      visible.set(
        columnId,
        sortByPosition(columnCards).filter((card) =>
          cardMatchesFilters(card, filters),
        ),
      )
    }
    return { cardsByColumn: visible, totalCardsByColumn: totals }
  }, [orderedColumns, cards, filters])

  const visibleCount = useMemo(
    () =>
      Array.from(cardsByColumn.values()).reduce(
        (total, columnCards) => total + columnCards.length,
        0,
      ),
    [cardsByColumn],
  )

  const filterActive = hasActiveFilters(filters)
  const activeCard =
    activeDrag?.type === 'card'
      ? cards.find((card) => card.id === activeDrag.id)
      : undefined

  const editingCard =
    cardModal?.mode === 'edit'
      ? cards.find((card) => card.id === cardModal.cardId)
      : undefined
  const modalColumnId =
    cardModal?.mode === 'create'
      ? cardModal.columnId
      : cardModal?.mode === 'edit'
        ? editingCard?.columnId
        : undefined
  const modalColumnTitle =
    orderedColumns.find((column) => column.id === modalColumnId)?.title ??
    'Board'

  const dialogColumn =
    columnDialog?.mode === 'rename'
      ? columns.find((column) => column.id === columnDialog.columnId)
      : undefined

  const columnToDeleteCardCount = columnToDelete
    ? cards.filter((card) => card.columnId === columnToDelete.id).length
    : 0

  function showToast(message: string, tone: ToastMessage['tone'] = 'success') {
    setToast({ id: Date.now(), message, tone })
  }

  function scrollBoardToEnd() {
    const scroller = boardRef.current
    if (!scroller) return
    scroller.scrollTo({
      left: scroller.scrollWidth,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    })
  }

  function scheduleClickSuppressionReset() {
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 150)
  }

  function handleDragStart(event: DragStartEvent) {
    const type = event.active.data.current?.type as DragType
    if (type === 'column') {
      // Reordering columns stays an administrator action.
      if (readOnly) return
    } else if (type === 'card') {
      const card = cards.find((item) => item.id === String(event.active.id))
      if (!card || !canMoveCard(currentUser, card)) return
    }
    suppressClickRef.current = true
    if (type === 'card' || type === 'column') {
      setActiveDrag({ type, id: String(event.active.id) })
    }
  }

  function handleDragCancel() {
    setActiveDrag(null)
    scheduleClickSuppressionReset()
  }

  function handleOpenCard(id: string) {
    if (suppressClickRef.current) return
    setCardModal({ mode: 'edit', cardId: id })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveDrag(null)
    scheduleClickSuppressionReset()
    if (!over) return

    const activeType = active.data.current?.type as DragType
    if (activeType === 'column') {
      // Reordering columns stays an administrator action.
      if (readOnly) return
      if (over.data.current?.type === 'column' && active.id !== over.id) {
        reorderColumn(String(active.id), String(over.id))
      }
      return
    }

    if (activeType !== 'card' || active.id === over.id) return

    const card = cards.find((item) => item.id === String(active.id))
    if (!card || !canMoveCard(currentUser, card)) return

    const overType = over.data.current?.type as
      | 'card'
      | 'card-drop'
      | undefined

    if (overType === 'card') {
      const target = cards.find((item) => item.id === String(over.id))
      if (!target) return

      if (target.columnId === card.columnId) {
        const ordered = sortByPosition(
          cards.filter((item) => item.columnId === card.columnId),
        )
        const overIndex = ordered.findIndex((item) => item.id === target.id)
        if (overIndex === -1) return
        // Mirrors arrayMove: dragging down drops after the target, up drops before it.
        moveCard(card.id, card.columnId, overIndex)
        return
      }

      const destination = sortByPosition(
        cards.filter((item) => item.columnId === target.columnId),
      )
      const targetIndex = destination.findIndex((item) => item.id === target.id)
      if (targetIndex === -1) return

      const translated = active.rect.current.translated
      const placeAfter =
        translated !== null &&
        translated.top + translated.height / 2 >
          over.rect.top + over.rect.height / 2

      moveCard(
        card.id,
        target.columnId,
        targetIndex + (placeAfter ? 1 : 0),
      )
      return
    }

    if (overType === 'card-drop') {
      const targetColumnId = over.data.current?.columnId as string | undefined
      if (!targetColumnId) return
      const destinationLength = cards.filter(
        (item) => item.columnId === targetColumnId,
      ).length
      moveCard(card.id, targetColumnId, destinationLength)
    }
  }

  function handleDeleteColumn() {
    if (!columnToDelete) return
    deleteColumn(columnToDelete.id)
    setColumnToDelete(null)
    showToast(`Deleted the ${columnToDelete.title} column.`)
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--color-paper)] text-[var(--color-ink)] dark:bg-slate-950 dark:text-slate-100">
      <AppHeader
        readOnly={readOnly}
        onSettingsClick={() => setSettingsOpen(true)}
        settingsDisabled={cardModal !== null}
      />

      <FilterBar
        readOnly={readOnly}
        filters={filters}
        labelOptions={labelOptions}
        visibleCount={visibleCount}
        totalCount={cards.length}
        onSearchChange={setSearch}
        onPriorityChange={setPriorityFilter}
        onLabelChange={setLabelFilter}
        onClearFilters={clearFilters}
        onAddColumn={() => setColumnDialog({ mode: 'add' })}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={boardCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <main
          ref={boardRef}
          className="scrollbar-slim board-surface min-h-0 flex-1 overflow-x-auto overflow-y-hidden bg-[var(--color-paper)] dark:bg-slate-950"
        >
          {orderedColumns.length === 0 ? (
            <BoardEmptyState
              readOnly={readOnly}
              onAddColumn={() => setColumnDialog({ mode: 'add' })}
            />
          ) : (
            <div className="grid h-full w-full min-w-full grid-flow-col auto-cols-[min(85vw,20rem)] items-stretch gap-4 p-4 sm:auto-cols-[minmax(260px,1fr)] sm:gap-5 sm:p-5">
              {orderedColumns.map((column, index) => (
                <Column
                  key={column.id}
                  readOnly={readOnly}
                  column={column}
                  cards={cardsByColumn.get(column.id) ?? []}
                  totalCardCount={totalCardsByColumn.get(column.id) ?? 0}
                  isFiltered={filterActive}
                  dragType={activeDrag?.type ?? null}
                  accentClass={COLUMN_ACCENTS[index % COLUMN_ACCENTS.length]}
                  onOpenCard={handleOpenCard}
                  onAddCard={(columnId) =>
                    setCardModal({ mode: 'create', columnId })
                  }
                  onRenameColumn={(target) =>
                    setColumnDialog({
                      mode: 'rename',
                      columnId: target.id,
                    })
                  }
                  onDeleteColumn={setColumnToDelete}
                />
              ))}
            </div>
          )}
        </main>

        <DragOverlay dropAnimation={null}>
          {activeCard ? <CardPreview card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>

      {cardModal?.mode === 'create' && !readOnly && (
        <CardModal
          key={`new-${cardModal.columnId}`}
          readOnly={readOnly}
          columnId={cardModal.columnId}
          columnTitle={
            orderedColumns.find((column) => column.id === cardModal.columnId)
              ?.title ?? 'Board'
          }
          onClose={() => setCardModal(null)}
        />
      )}

      {cardModal?.mode === 'edit' && editingCard && (
        <CardModal
          key={editingCard.id}
          readOnly={readOnly}
          card={editingCard}
          columnId={editingCard.columnId}
          columnTitle={modalColumnTitle}
          onClose={() => setCardModal(null)}
        />
      )}

      {columnDialog && !readOnly && (
        <ColumnModal
          key={
            columnDialog.mode === 'rename'
              ? `rename-${columnDialog.columnId}`
              : 'new-column'
          }
          mode={columnDialog.mode}
          initialTitle={dialogColumn?.title ?? ''}
          onClose={() => setColumnDialog(null)}
          onSubmit={(title) => {
            if (columnDialog.mode === 'add') {
              addColumn(title)
              window.setTimeout(scrollBoardToEnd, 80)
            } else if (dialogColumn) {
              renameColumn(dialogColumn.id, title)
            }
          }}
        />
      )}

      <ConfirmDialog
        open={columnToDelete !== null && !readOnly}
        title={`Delete ${columnToDelete?.title ?? 'column'}?`}
        description={
          <div className="space-y-2">
            <p>
              {columnToDeleteCardCount > 0
                ? `This removes the column and its ${columnToDeleteCardCount} ${
                    columnToDeleteCardCount === 1 ? 'card' : 'cards'
                  } from this board.`
                : 'This removes the column from this board.'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              This action can't be undone.
            </p>
          </div>
        }
        confirmLabel="Delete column"
        onClose={() => setColumnToDelete(null)}
        onConfirm={handleDeleteColumn}
      />

      <SettingsModal
        open={settingsOpen && !readOnly}
        onClose={() => setSettingsOpen(false)}
        onNotify={showToast}
      />

      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}
