import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Board, Card, CardInput, CardUpdate, Column } from '../types'
import { arrayMove, sortByPosition } from '../utils/array'
import { dateFromToday } from '../utils/dates'
import { createId } from '../utils/id'
import { normalizeLabels } from '../utils/labels'
import { sqliteStorage } from './sqliteStorage'
import { useUiStore } from './uiStore'

function canEditBoard() {
  return useUiStore.getState().adminUnlocked
}

interface BoardState extends Board {
  addColumn: (title: string) => string
  renameColumn: (id: string, title: string) => void
  deleteColumn: (id: string) => void
  reorderColumn: (activeId: string, overId: string) => void
  addCard: (input: CardInput) => string
  updateCard: (id: string, update: CardUpdate) => void
  deleteCard: (id: string) => void
  moveCard: (cardId: string, toColumnId: string, toIndex: number) => void
  renameLabel: (oldLabel: string, newLabel: string) => void
  deleteLabel: (label: string) => void
  addLabel: (label: string) => string | null
  replaceBoard: (board: Board) => void
}

function createSeedBoard(): Board {
  const todo = createId()
  const inProgress = createId()
  const review = createId()
  const done = createId()

  const columns: Column[] = [
    { id: todo, title: 'To Do', order: 0 },
    { id: inProgress, title: 'In Progress', order: 1 },
    { id: review, title: 'Review', order: 2 },
    { id: done, title: 'Done', order: 3 },
  ]

  const cards: Card[] = [
    {
      id: createId(),
      columnId: todo,
      title: 'Polish the empty states',
      description:
        'Make every empty view feel intentional with helpful copy and a clear next step.',
      priority: 'medium',
      dueDate: dateFromToday(2),
      labels: ['Design', 'Polish'],
      assignee: 'Alex Morgan',
      position: 0,
    },
    {
      id: createId(),
      columnId: todo,
      title: 'Fix card drag on touch devices',
      description:
        'Long-press to drag on mobile and confirm the scroll behavior feels natural.',
      priority: 'high',
      dueDate: dateFromToday(-1),
      labels: ['Bug'],
      assignee: 'Priya Shah',
      position: 1,
    },
    {
      id: createId(),
      columnId: inProgress,
      title: 'Plan the Q4 roadmap',
      description:
        'Collect team input, size the bets, and share a first draft for review.',
      priority: 'medium',
      dueDate: dateFromToday(5),
      labels: ['Planning'],
      assignee: 'Jordan Lee',
      position: 0,
    },
    {
      id: createId(),
      columnId: done,
      title: 'Set up the design tokens',
      description:
        'Agree on colors, spacing, and typography before building the first screens.',
      priority: 'low',
      dueDate: null,
      labels: ['Design'],
      assignee: 'Alex Morgan',
      position: 0,
    },
  ]

  return {
    columns,
    cards,
    labels: normalizeLabels(cards.flatMap((card) => card.labels)),
  }
}



export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      ...createSeedBoard(),

      addColumn: (title) => {
        if (!canEditBoard()) return ''
        const id = createId()
        set((state) => ({
          columns: [
            ...state.columns,
            { id, title: title.trim(), order: state.columns.length },
          ],
        }))
        return id
      },

      renameColumn: (id, title) => {
        if (!canEditBoard()) return
        const trimmed = title.trim()
        if (!trimmed) return
        set((state) => ({
          columns: state.columns.map((column) =>
            column.id === id ? { ...column, title: trimmed } : column,
          ),
        }))
      },

      deleteColumn: (id) => {
        if (!canEditBoard()) return
        set((state) => ({
          columns: [...state.columns]
            .filter((column) => column.id !== id)
            .sort((first, second) => first.order - second.order)
            .map((column, index) => ({ ...column, order: index })),
          cards: state.cards.filter((card) => card.columnId !== id),
        }))
      },

      reorderColumn: (activeId, overId) => {
        if (!canEditBoard()) return
        if (activeId === overId) return
        set((state) => {
          const ordered = [...state.columns].sort(
            (first, second) => first.order - second.order,
          )
          const from = ordered.findIndex((column) => column.id === activeId)
          const to = ordered.findIndex((column) => column.id === overId)
          if (from === -1 || to === -1) return state

          return {
            columns: arrayMove(ordered, from, to).map((column, index) => ({
              ...column,
              order: index,
            })),
          }
        })
      },

      addCard: (input) => {
        if (!canEditBoard()) return ''
        const id = createId()
        set((state) => ({
          cards: [
            ...state.cards,
            {
              ...input,
              id,
              title: input.title.trim(),
              description: input.description.trim(),
              assignee: input.assignee.trim(),
              labels: normalizeLabels(input.labels),
              position: state.cards.filter(
                (card) => card.columnId === input.columnId,
              ).length,
            },
          ],
          labels: normalizeLabels([...state.labels, ...input.labels]),
        }))
        return id
      },

      updateCard: (id, update) => {
        if (!canEditBoard()) return
        set((state) => {
          const card = state.cards.find((item) => item.id === id)
          if (!card) return state

          const nextLabels =
            update.labels === undefined
              ? card.labels
              : normalizeLabels(update.labels)

          return {
            cards: state.cards.map((item) => {
              if (item.id !== id) return item
              return {
                ...item,
                ...update,
                title:
                  update.title === undefined ? item.title : update.title.trim(),
                description:
                  update.description === undefined
                    ? item.description
                    : update.description.trim(),
                assignee:
                  update.assignee === undefined
                    ? item.assignee
                    : update.assignee.trim(),
                labels: nextLabels,
              }
            }),
            labels: normalizeLabels([...state.labels, ...nextLabels]),
          }
        })
      },

      deleteCard: (id) => {
        if (!canEditBoard()) return
        set((state) => {
          const target = state.cards.find((card) => card.id === id)
          if (!target) return state

          const remaining = state.cards.filter((card) => card.id !== id)
          const columnCards = sortByPosition(
            remaining.filter((card) => card.columnId === target.columnId),
          )
          const positions = new Map(
            columnCards.map((card, index) => [card.id, index]),
          )

          return {
            cards: remaining.map((card) => {
              const position = positions.get(card.id)
              return position === undefined ? card : { ...card, position }
            }),
          }
        })
      },

      moveCard: (cardId, toColumnId, toIndex) => {
        if (!canEditBoard()) return
        set((state) => {
          const card = state.cards.find((item) => item.id === cardId)
          if (!card) return state
          if (!state.columns.some((column) => column.id === toColumnId)) {
            return state
          }

          const sameColumn = card.columnId === toColumnId
          const destination = sortByPosition(
            state.cards.filter(
              (item) => item.columnId === toColumnId && item.id !== cardId,
            ),
          )
          const source = sameColumn
            ? destination
            : sortByPosition(
                state.cards.filter(
                  (item) =>
                    item.columnId === card.columnId && item.id !== cardId,
                ),
              )

          const insertAt = Math.max(0, Math.min(toIndex, destination.length))
          const nextDestination = [...destination]
          nextDestination.splice(insertAt, 0, {
            ...card,
            columnId: toColumnId,
          })

          const positions = new Map<string, number>()
          nextDestination.forEach((item, index) => {
            positions.set(item.id, index)
          })
          if (!sameColumn) {
            source.forEach((item, index) => {
              positions.set(item.id, index)
            })
          }

          return {
            cards: state.cards.map((item) => {
              const position = positions.get(item.id)
              if (position === undefined) return item
              if (item.id === cardId) {
                return { ...item, columnId: toColumnId, position }
              }
              return { ...item, position }
            }),
          }
        })
      },

      renameLabel: (oldLabel, newLabel) => {
        if (!canEditBoard()) return
        const previous = oldLabel.trim()
        const next = newLabel.trim()
        if (!previous || !next || previous.toLowerCase() === next.toLowerCase() && previous === next) {
          return
        }

        set((state) => {
          const canonicalNext =
            state.cards
              .flatMap((card) => card.labels)
              .find((label) => label.toLowerCase() === next.toLowerCase()) ?? next

          return {
            cards: state.cards.map((card) => {
              if (!card.labels.some((label) => label.toLowerCase() === previous.toLowerCase())) {
                return card
              }

              return {
                ...card,
                labels: normalizeLabels(
                  card.labels.map((label) =>
                    label.toLowerCase() === previous.toLowerCase() ? canonicalNext : label,
                  ),
                ),
              }
            }),
            labels: normalizeLabels(
              state.labels.map((label) =>
                label.toLowerCase() === previous.toLowerCase() ? canonicalNext : label,
              ),
            ),
          }
        })
      },

      deleteLabel: (label) => {
        if (!canEditBoard()) return
        const target = label.trim()
        if (!target) return

        set((state) => ({
          cards: state.cards.map((card) => ({
            ...card,
            labels: card.labels.filter(
              (existing) => existing.toLowerCase() !== target.toLowerCase(),
            ),
          })),
          labels: state.labels.filter(
            (existing) => existing.toLowerCase() !== target.toLowerCase(),
          ),
        }))
      },

      addLabel: (label) => {
        if (!canEditBoard()) return null
        const trimmed = label.trim()
        if (!trimmed) return null

        const state = get()
        const existing = state.labels.find(
          (item) => item.toLowerCase() === trimmed.toLowerCase(),
        )
        if (existing) return existing

        set((current) => ({
          labels: normalizeLabels([...current.labels, trimmed]),
        }))
        return trimmed
      },

      replaceBoard: (board) => {
        if (!canEditBoard()) return
        set({
          columns: board.columns.map((column) => ({ ...column })),
          cards: board.cards.map((card) => ({
            ...card,
            labels: normalizeLabels(card.labels),
          })),
          labels: normalizeLabels([
            ...(Array.isArray(board.labels) ? board.labels : []),
            ...board.cards.flatMap((card) => card.labels),
          ]),
        })
      },
    }),
    {
      name: 'flowboard.board',
      version: 1,
      storage: createJSONStorage(() => sqliteStorage),
      partialize: (state) => ({
        columns: state.columns,
        cards: state.cards,
      }),
      merge: (persisted, current) => {
        const data = persisted as Partial<Board> | undefined
        if (!data || !Array.isArray(data.columns) || !Array.isArray(data.cards)) {
          return current
        }
        return {
          ...current,
          columns: data.columns,
          cards: data.cards.map((card) => ({
            ...card,
            labels: normalizeLabels(Array.isArray(card.labels) ? card.labels : []),
          })),
          labels: normalizeLabels([
            ...(Array.isArray(data.labels) ? data.labels : []),
            ...data.cards.flatMap((card) =>
              Array.isArray(card.labels) ? card.labels : [],
            ),
          ]),
        }
      },
    },
  ),
)
