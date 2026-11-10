import { useEffect, useState } from 'react'
import { socket } from '../services/socket'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import type { ConnectionStatus, User } from '../types'
import { Button } from './ui/Button'
import {
  DownloadIcon,
  LogoMark,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  UploadIcon,
} from './ui/icons'

interface AppHeaderProps {
  readOnly: boolean
  onExport: () => void
  onImportClick: () => void
  onSettingsClick: () => void
  settingsDisabled?: boolean
}

export function AppHeader({
  readOnly,
  onExport,
  onImportClick,
  onSettingsClick,
  settingsDisabled = false,
}: AppHeaderProps) {
  const theme = useUiStore((state) => state.theme)
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const requestAdminLogin = useAuthStore((state) => state.requestAdminLogin)

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() => socket.getStatus())
  const [onlineUsers, setOnlineUsers] = useState<User[]>(() => socket.getOnlineUsers())

  useEffect(() => {
    const unsubStatus = socket.onStatusChange((status) => setConnectionStatus(status))
    const unsubPresence = socket.onPresenceChange((users) => setOnlineUsers(users))
    return () => {
      unsubStatus()
      unsubPresence()
    }
  }, [])

  return (
    <header className="shrink-0 border-b border-[var(--color-rail)] bg-[var(--color-paper)]/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <LogoMark className="h-9 w-9 shrink-0 rounded-md ring-1 ring-[var(--color-rail)] dark:ring-slate-800" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[1.2rem] leading-tight font-semibold tracking-tight text-[var(--color-ink)] dark:text-white">
              Flowboard
            </h1>
            {/* Live Connection Badge */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800'
                  : connectionStatus === 'reconnecting'
                    ? 'animate-pulse bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800'
                    : 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800'
              }`}
              title={
                connectionStatus === 'connected'
                  ? 'Synchronized with LAN server'
                  : connectionStatus === 'reconnecting'
                    ? 'Reconnecting to LAN server…'
                    : 'Disconnected from server'
              }
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-500'
                    : connectionStatus === 'reconnecting'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                }`}
              />
              <span className="hidden sm:inline">
                {connectionStatus === 'connected'
                  ? 'Live'
                  : connectionStatus === 'reconnecting'
                    ? 'Reconnecting…'
                    : 'Offline'}
              </span>
            </span>

            {/* Active LAN Collaborators indicator */}
            {onlineUsers.length > 0 && (
              <span
                className="hidden items-center gap-1 text-[11px] text-slate-500 md:inline-flex dark:text-slate-400"
                title={`Active teammates on LAN: ${onlineUsers.map((u) => u.displayName || u.username).join(', ')}`}
              >
                <span>•</span>
                <span>{onlineUsers.length} online</span>
              </span>
            )}
          </div>
          <p className="hidden text-[11px] text-[color:rgb(31_41_51/0.65)] sm:block dark:text-slate-400">
            Real-Time LAN Project Collaboration
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {/* User profile & role pill */}
          {user && (
            <div className="mr-1 flex items-center gap-2 rounded-lg bg-slate-100/80 px-2.5 py-1 text-xs dark:bg-slate-900">
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {user.displayName || user.username}
              </span>
              <span
                className={`rounded px-1.5 py-0.2 text-[10px] font-semibold uppercase tracking-wider ${
                  user.role === 'admin'
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {user.role}
              </span>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onExport}
            aria-label="Export board as JSON"
            title="Export board as JSON"
            className="h-8"
          >
            <DownloadIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>

          {!readOnly && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onImportClick}
                aria-label="Import board from JSON"
                title="Import board from JSON"
                className="h-8"
              >
                <UploadIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Import</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onSettingsClick}
                disabled={settingsDisabled}
                aria-label="Open settings"
                title={settingsDisabled ? 'Close the card editor first' : 'Open settings'}
                className="h-8 w-8"
              >
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </>
          )}

          {user && user.role === 'admin' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="h-8 text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300"
              title="Sign out of admin account"
            >
              Sign out
            </Button>
          )}

          {user && user.role !== 'admin' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={requestAdminLogin}
              className="h-8 text-xs text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300"
              title="Sign in as administrator"
            >
              Admin sign in
            </Button>
          )}

          <div className="mx-1 h-5 w-px bg-[var(--color-rail)] dark:bg-slate-800" />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={
              theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
            title={
              theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
            className="h-8 w-8"
          >
            {theme === 'dark' ? (
              <SunIcon className="h-4 w-4" />
            ) : (
              <MoonIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  )
}
