import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Filters, Priority, Theme } from '../types'
import { sqliteStorage } from './sqliteStorage'

interface UiState {
  theme: Theme
  filters: Filters
  adminPasscode: string
  adminUnlocked: boolean
  toggleTheme: () => void
  setSearch: (search: string) => void
  setPriorityFilter: (priority: Priority | null) => void
  setLabelFilter: (label: string | null) => void
  clearFilters: () => void
  unlockAdmin: (passcode: string) => boolean
  lockAdmin: () => void
  setAdminPasscode: (passcode: string) => void
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
    (set, get) => ({
      theme: getSystemTheme(),
      filters: emptyFilters,
      adminPasscode: '4dmin@2026!',
      adminUnlocked: false,

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

      unlockAdmin: (passcode) => {
        if (passcode !== get().adminPasscode) {
          return false
        }
        set({ adminUnlocked: true })
        return true
      },

      lockAdmin: () => {
        set({ adminUnlocked: false })
      },

      setAdminPasscode: (passcode) => {
        const next = passcode.trim()
        if (!next) {
          return
        }
        set({ adminPasscode: next })
      },
    }),
    {
      name: 'flowboard.ui',
      version: 1,
      storage: createJSONStorage(() => sqliteStorage),
      partialize: (state) => ({
        theme: state.theme,
        adminPasscode: state.adminPasscode,
        adminUnlocked: state.adminUnlocked,
      }),
    },
  ),
)
