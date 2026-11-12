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
  /** Resolves with null on success, or with the error message to display. */
  setPassword: (currentPassword: string, newPassword: string) => Promise<string | null>
  logout: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  error: null,

  checkAuth: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await api.getMe()
      if (res.user) {
        set({ user: res.user, isLoading: false })
        socket.connect()
      } else {
        // No active session: the sign-in page is the landing page.
        set({ user: null, isLoading: false })
        socket.disconnect()
      }
    } catch {
      set({ user: null, isLoading: false })
      socket.disconnect()
    }
  },

  login: async (username: string, password: string) => {
    // The global loading flag is deliberately left alone: flipping it would
    // unmount the sign-in form and clear the fields the user just typed.
    set({ error: null })
    try {
      const res = await api.login(username, password)
      set({ user: res.user, error: null })
      // Re-handshake the socket so it carries the new session cookie. An open
      // socket keeps the previous account's identity, which would break the
      // server-side per-account event filtering after an account switch.
      socket.disconnect()
      socket.connect()
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed'
      set({ error: message })
      return false
    }
  },

  setPassword: async (currentPassword: string, newPassword: string): Promise<string | null> => {
    try {
      await api.changePassword(currentPassword, newPassword)
      const user = get().user
      set({ user: user ? { ...user, mustChangePassword: false } : user })
      return null
    } catch (err: unknown) {
      // The message is returned instead of being stored globally: the global
      // loading flag would swap the whole app for the loading screen and
      // clear the form the user just filled in.
      return err instanceof Error ? err.message : 'Failed to update the password.'
    }
  },

  logout: async () => {
    try {
      await api.logout()
    } finally {
      set({ user: null })
      socket.disconnect()
      await get().checkAuth()
    }
  },

  clearError: () => set({ error: null }),
}))
