import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Filters, Priority, Theme } from '../types'
import { sqliteStorage } from './sqliteStorage'

interface UiState {
  theme: Theme
  filters: Filters
  toggleTheme: () => void
  setSearch: (search: string) => void
  setPriorityFilter: (priority: Priority | null) => void
  setLabelFilter: (label: string | null) => void
  clearFilters: () => void
}

const emptyFilters: Filters = { search: '', priority: null, label: null }

function getSystemTheme(): Theme {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }
  return 'light'
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: getSystemTheme(),
      filters: emptyFilters,

      toggleTheme: () => {
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' }))
      },

      setSearch: (search) => {
        set((state) => ({ filters: { ...state.filters, search } }))
      },

      setPriorityFilter: (priority) => {
        set((state) => ({ filters: { ...state.filters, priority } }))
      },

      setLabelFilter: (label) => {
        set((state) => ({ filters: { ...state.filters, label } }))
      },

      clearFilters: () => {
        set({ filters: emptyFilters })
      },
    }),
    {
      name: 'flowboard.ui',
      version: 1,
      storage: createJSONStorage(() => sqliteStorage),
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
)
