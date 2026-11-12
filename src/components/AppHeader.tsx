import { useEffect, useState } from 'react'
import { socket } from '../services/socket'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import type { ConnectionStatus, PresenceUser } from '../types'
import { Button } from './ui/Button'
import { LockIcon, LogoMark, MoonIcon, SettingsIcon, SunIcon } from './ui/icons'

interface AppHeaderProps {
  readOnly: boolean
  onSettingsClick: () => void
  settingsDisabled?: boolean
}

export function AppHeader({
  readOnly,
  onSettingsClick,
  settingsDisabled = false,
}: AppHeaderProps) {
  const theme = useUiStore((state) => state.theme)
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() => socket.getStatus())
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>(() => socket.getOnlineUsers())

  useEffect(() => {
    const unsubStatus = socket.onStatusChange((status) => setConnectionStatus(status))
    const unsubPresence = socket.onPresenceChange((users) => setOnlineUsers(users))
    return () => {
      unsubStatus()
      unsubPresence()
    }
  }, [])

  return (
    <header className="relative z-30 shrink-0 border-b border-[var(--color-rail)] bg-[var(--color-paper)]/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
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
          {/* Label scope indicator: which tasks this account may see */}
          {user && user.role !== 'admin' && (
            <span
              className="hidden max-w-[300px] items-center gap-1.5 rounded-lg bg-indigo-50/80 px-2.5 py-1 text-[11px] text-indigo-700 ring-1 ring-indigo-600/15 lg:inline-flex dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-400/20"
              title={
                user.labels.length > 0
                  ? `This account only sees cards labeled: ${user.labels.join(', ')}`
                  : 'This account has no labels assigned, so it sees no cards'
              }
            >
              <LockIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {user.labels.length > 0
                  ? `Your labels: ${user.labels.join(', ')}`
                  : 'No labels assigned'}
              </span>
            </span>
          )}

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

          {!readOnly && (
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
          )}

          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void logout()}
              className="h-8 text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300"
              title="Sign out of this account"
            >
              Sign out
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
