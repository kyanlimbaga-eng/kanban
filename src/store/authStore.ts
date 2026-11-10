import { create } from 'zustand'
import { api } from '../services/api'
import { socket } from '../services/socket'
import type { User } from '../types'

interface AuthState {
  user: User | null
  isLoading: boolean
  error: string | null
  adminLoginRequested: boolean
  checkAuth: () => Promise<void>
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  requestAdminLogin: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  error: null,
  adminLoginRequested: false,

  checkAuth: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await api.getMe()
      if (res.user) {
        set({ user: res.user, isLoading: false })
        socket.connect()
      } else {
        if (get().adminLoginRequested) {
          set({ user: null, isLoading: false })
          socket.disconnect()
        } else {
          const viewerRes = await api.login('viewer', 'viewer123')
          set({ user: viewerRes.user, isLoading: false, error: null })
          socket.connect()
        }
      }
    } catch {
      if (get().adminLoginRequested) {
        set({ user: null, isLoading: false })
      } else {
        set({ user: null, isLoading: false })
      }
      socket.disconnect()
    }
  },

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const res = await api.login(username, password)
      set({ user: res.user, isLoading: false, error: null, adminLoginRequested: false })
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
      set({ user: null, adminLoginRequested: false })
      socket.disconnect()
      await get().checkAuth()
    }
  },

  requestAdminLogin: async () => {
    set({ adminLoginRequested: true, error: null })
    try {
      await api.logout()
    } finally {
      set({ user: null })
      socket.disconnect()
    }
  },

  clearError: () => set({ error: null }),
}))
