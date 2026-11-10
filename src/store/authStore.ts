import { create } from 'zustand'
import { api } from '../services/api'
import { socket } from '../services/socket'
import type { User } from '../types'

interface AuthState {
  user: User | null
  isLoading: boolean
  error: string | null
  checkAuth: () => Promise<void>
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,

  checkAuth: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await api.getMe()
      set({ user: res.user, isLoading: false })
      if (res.user) {
        socket.connect()
      } else {
        socket.disconnect()
      }
    } catch {
      set({ user: null, isLoading: false })
      socket.disconnect()
    }
  },

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const res = await api.login(username, password)
      set({ user: res.user, isLoading: false, error: null })
      socket.connect()
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed'
      set({ error: message, isLoading: false })
      return false
    }
  },

  logout: async () => {
    try {
      await api.logout()
    } finally {
      set({ user: null })
      socket.disconnect()
    }
  },

  clearError: () => set({ error: null }),
}))
