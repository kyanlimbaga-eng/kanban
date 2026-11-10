import { create } from 'zustand'
import { api } from '../services/api'
import { socket } from '../services/socket'
import type { Board, Card, CardInput, CardUpdate, Column } from '../types'
import { arrayMove, sortByPosition } from '../utils/array'
import { createId } from '../utils/id'
import { normalizeLabels } from '../utils/labels'

interface BoardState extends Board {
  isLoading: boolean
  error: string | null
  fetchBoard: () => Promise<void>
  addColumn: (title: string) => Promise<string>
  renameColumn: (id: string, title: string) => Promise<void>
  deleteColumn: (id: string) => Promise<void>
  reorderColumn: (activeId: string, overId: string) => Promise<void>
  addCard: (input: CardInput) => Promise<string>
  updateCard: (id: string, update: CardUpdate) => Promise<Card | null>
  deleteCard: (id: string) => Promise<void>
  moveCard: (cardId: string, toColumnId: string, toIndex: number) => Promise<void>
  renameLabel: (oldLabel: string, newLabel: string) => Promise<void>
  deleteLabel: (label: string) => Promise<void>
  addLabel: (label: string) => Promise<string | null>
  replaceBoard: (board: Board) => Promise<void>
}

let socketSubscribed = false

export const useBoardStore = create<BoardState>((set, get) => {
  function setupSocketListeners() {
    if (socketSubscribed || typeof window === 'undefined') return
    socketSubscribed = true

    // Re-sync board automatically on WebSocket reconnection
    socket.onStatusChange((status) => {
      if (status === 'connected') {
        get().fetchBoard()
      }
    })

    // Handle real-time broadcast events from server
    socket.onEvent((event) => {
      const { type, payload } = event

      switch (type) {
        case 'COLUMN_CREATED': {
          const col = payload as Column
          set((state) => {
            if (state.columns.some((c) => c.id === col.id)) return state
            return { columns: [...state.columns, col] }
          })
          break
        }
        case 'COLUMN_RENAMED': {
          const { id, title } = payload as { id: string; title: string }
          set((state) => ({
            columns: state.columns.map((c) => (c.id === id ? { ...c, title } : c)),
          }))
          break
        }
        case 'COLUMN_DELETED': {
          const { id } = payload as { id: string }
          set((state) => ({
            columns: state.columns.filter((c) => c.id !== id),
            cards: state.cards.filter((card) => card.columnId !== id),
          }))
          break
        }
        case 'COLUMNS_REORDERED': {
          const { columnIds } = payload as { columnIds: string[] }
          set((state) => {
            const map = new Map(state.columns.map((c) => [c.id, c]))
            const reordered = columnIds
              .map((id, idx) => {
                const col = map.get(id)
                return col ? { ...col, order: idx } : null
              })
              .filter((c): c is Column => c !== null)
            return { columns: reordered }
          })
          break
        }
        case 'CARD_CREATED': {
          const card = payload as Card
          set((state) => {
            if (state.cards.some((c) => c.id === card.id)) return state
            return { cards: sortByPosition([...state.cards, card]) }
          })
          break
        }
        case 'CARD_UPDATED': {
          const updated = payload as Card
          set((state) => ({
            cards: state.cards.map((c) => (c.id === updated.id ? updated : c)),
          }))
          break
        }
        case 'CARD_MOVED': {
          const { cardId, fromColumnId, toColumnId, toIndex } = payload as {
            cardId: string
            fromColumnId: string
            toColumnId: string
            toIndex: number
          }
          set((state) => {
            const card = state.cards.find((c) => c.id === cardId)
            if (!card) return state

            const targetCards = sortByPosition(
              state.cards.filter((c) => c.columnId === toColumnId && c.id !== cardId),
            )
            const insertIndex = Math.min(Math.max(toIndex, 0), targetCards.length)
            const movedCard = { ...card, columnId: toColumnId }

            const nextTargetCards = [
              ...targetCards.slice(0, insertIndex),
              movedCard,
              ...targetCards.slice(insertIndex),
            ].map((c, idx) => ({ ...c, position: idx }))

            const otherCards = state.cards.filter(
              (c) => c.columnId !== toColumnId && c.columnId !== fromColumnId && c.id !== cardId,
            )

            let nextSourceCards: Card[] = []
            if (fromColumnId !== toColumnId) {
              nextSourceCards = sortByPosition(
                state.cards.filter((c) => c.columnId === fromColumnId && c.id !== cardId),
              ).map((c, idx) => ({ ...c, position: idx }))
            }

            return {
              cards: [...otherCards, ...nextSourceCards, ...nextTargetCards],
            }
          })
          break
        }
        case 'CARD_DELETED': {
          const { id } = payload as { id: string }
          set((state) => ({
            cards: state.cards.filter((c) => c.id !== id),
          }))
          break
        }
        case 'LABEL_CREATED': {
          const { name } = payload as { name: string }
          set((state) => ({
            labels: normalizeLabels([...state.labels, name]),
          }))
          break
        }
        case 'LABEL_RENAMED': {
          const { oldName, newName } = payload as { oldName: string; newName: string }
          set((state) => ({
            labels: normalizeLabels(
              state.labels.map((l) => (l.toLowerCase() === oldName.toLowerCase() ? newName : l)),
            ),
            cards: state.cards.map((c) => ({
              ...c,
              labels: normalizeLabels(
                c.labels.map((l) => (l.toLowerCase() === oldName.toLowerCase() ? newName : l)),
              ),
            })),
          }))
          break
        }
        case 'LABEL_DELETED': {
          const { name } = payload as { name: string }
          set((state) => ({
            labels: state.labels.filter((l) => l.toLowerCase() !== name.toLowerCase()),
            cards: state.cards.map((c) => ({
              ...c,
              labels: c.labels.filter((l) => l.toLowerCase() !== name.toLowerCase()),
            })),
          }))
          break
        }
        case 'BOARD_REPLACED': {
          get().fetchBoard()
          break
        }
      }
    })
  }

  // Initialize socket listener
  setupSocketListeners()

  return {
    columns: [],
    cards: [],
    labels: [],
    isLoading: true,
    error: null,

    fetchBoard: async () => {
      try {
        const board = await api.getBoard()
        set({
          columns: board.columns,
          cards: board.cards,
          labels: board.labels,
          isLoading: false,
          error: null,
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch board'
        set({ isLoading: false, error: message })
      }
    },

    addColumn: async (title: string) => {
      const cleanTitle = title.trim()
      if (!cleanTitle) return ''
      try {
        const col = await api.createColumn(cleanTitle)
        set((state) => ({
          columns: [...state.columns, col],
        }))
        return col.id
      } catch (err) {
        console.error('Failed to add column:', err)
        return ''
      }
    },

    renameColumn: async (id: string, title: string) => {
      const cleanTitle = title.trim()
      if (!cleanTitle) return
      set((state) => ({
        columns: state.columns.map((c) => (c.id === id ? { ...c, title: cleanTitle } : c)),
      }))
      try {
        await api.renameColumn(id, cleanTitle)
      } catch (err) {
        console.error('Failed to rename column:', err)
        get().fetchBoard()
      }
    },

    deleteColumn: async (id: string) => {
      set((state) => ({
        columns: state.columns.filter((c) => c.id !== id),
        cards: state.cards.filter((c) => c.columnId !== id),
      }))
      try {
        await api.deleteColumn(id)
      } catch (err) {
        console.error('Failed to delete column:', err)
        get().fetchBoard()
      }
    },

    reorderColumn: async (activeId: string, overId: string) => {
      if (activeId === overId) return
      const currentCols = get().columns
      const oldIndex = currentCols.findIndex((c) => c.id === activeId)
      const newIndex = currentCols.findIndex((c) => c.id === overId)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(currentCols, oldIndex, newIndex).map((c, idx) => ({
        ...c,
        order: idx,
      }))
      set({ columns: reordered })

      try {
        await api.reorderColumns(reordered.map((c) => c.id))
      } catch (err) {
        console.error('Failed to reorder columns:', err)
        get().fetchBoard()
      }
    },

    addCard: async (input: CardInput) => {
      const tempId = createId()
      try {
        const created = await api.createCard(input)
        set((state) => ({
          cards: sortByPosition([...state.cards, created]),
          labels: normalizeLabels([...state.labels, ...(created.labels || [])]),
        }))
        return created.id
      } catch (err) {
        console.error('Failed to add card:', err)
        return tempId
      }
    },

    updateCard: async (id: string, update: CardUpdate) => {
      const currentCard = get().cards.find((c) => c.id === id)
      try {
        const payload = {
          ...update,
          version: currentCard?.version,
        }
        const updated = await api.updateCard(id, payload)
        set((state) => ({
          cards: state.cards.map((c) => (c.id === id ? updated : c)),
          labels: normalizeLabels([...state.labels, ...(updated.labels || [])]),
        }))
        return updated
      } catch (err: unknown) {
        console.error('Failed to update card:', err)
        get().fetchBoard()
        throw err
      }
    },

    deleteCard: async (id: string) => {
      set((state) => ({
        cards: state.cards.filter((c) => c.id !== id),
      }))
      try {
        await api.deleteCard(id)
      } catch (err) {
        console.error('Failed to delete card:', err)
        get().fetchBoard()
      }
    },

    moveCard: async (cardId: string, toColumnId: string, toIndex: number) => {
      const state = get()
      const card = state.cards.find((c) => c.id === cardId)
      if (!card) return

      const fromColumnId = card.columnId
      const targetCards = sortByPosition(
        state.cards.filter((c) => c.columnId === toColumnId && c.id !== cardId),
      )
      const insertIndex = Math.min(Math.max(toIndex, 0), targetCards.length)
      const movedCard = { ...card, columnId: toColumnId }

      const nextTargetCards = [
        ...targetCards.slice(0, insertIndex),
        movedCard,
        ...targetCards.slice(insertIndex),
      ].map((c, idx) => ({ ...c, position: idx }))

      const otherCards = state.cards.filter(
        (c) => c.columnId !== toColumnId && c.columnId !== fromColumnId && c.id !== cardId,
      )

      let nextSourceCards: Card[] = []
      if (fromColumnId !== toColumnId) {
        nextSourceCards = sortByPosition(
          state.cards.filter((c) => c.columnId === fromColumnId && c.id !== cardId),
        ).map((c, idx) => ({ ...c, position: idx }))
      }

      set({ cards: [...otherCards, ...nextSourceCards, ...nextTargetCards] })

      try {
        await api.moveCard(cardId, toColumnId, insertIndex)
      } catch (err) {
        console.error('Failed to move card:', err)
        get().fetchBoard()
      }
    },

    renameLabel: async (oldLabel: string, newLabel: string) => {
      const cleanNew = newLabel.trim()
      if (!cleanNew) return
      set((state) => ({
        labels: normalizeLabels(
          state.labels.map((l) => (l.toLowerCase() === oldLabel.toLowerCase() ? cleanNew : l)),
        ),
        cards: state.cards.map((c) => ({
          ...c,
          labels: normalizeLabels(
            c.labels.map((l) => (l.toLowerCase() === oldLabel.toLowerCase() ? cleanNew : l)),
          ),
        })),
      }))
      try {
        await api.renameLabel(oldLabel, cleanNew)
      } catch (err) {
        console.error('Failed to rename label:', err)
        get().fetchBoard()
      }
    },

    deleteLabel: async (label: string) => {
      set((state) => ({
        labels: state.labels.filter((l) => l.toLowerCase() !== label.toLowerCase()),
        cards: state.cards.map((c) => ({
          ...c,
          labels: c.labels.filter((l) => l.toLowerCase() !== label.toLowerCase()),
        })),
      }))
      try {
        await api.deleteLabel(label)
      } catch (err) {
        console.error('Failed to delete label:', err)
        get().fetchBoard()
      }
    },

    addLabel: async (label: string) => {
      const clean = label.trim()
      if (!clean) return null
      set((state) => ({
        labels: normalizeLabels([...state.labels, clean]),
      }))
      try {
        const res = await api.createLabel(clean)
        return res.name
      } catch (err) {
        console.error('Failed to add label:', err)
        return clean
      }
    },

    replaceBoard: async (board: Board) => {
      set({
        columns: board.columns,
        cards: board.cards,
        labels: board.labels,
      })
      try {
        await api.importBoard(board)
      } catch (err) {
        console.error('Failed to import board:', err)
        get().fetchBoard()
        throw err
      }
    },
  }
})
