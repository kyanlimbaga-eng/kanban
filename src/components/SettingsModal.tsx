import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { api } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { useBoardStore } from '../store/boardStore'
import { useUiStore } from '../store/uiStore'
import type { AuditLog, User, UserRole } from '../types'
import { cn } from '../utils/cn'
import { formatRelativeTime } from '../utils/dates'
import { getLabelDotClass } from '../utils/labels'
import { Button } from './ui/Button'
import { Field, Input, Select } from './ui/Input'
import { Modal } from './ui/Modal'
import { TrashIcon } from './ui/icons'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  onNotify?: (message: string, tone?: 'success' | 'error') => void
}

interface LabelRow {
  name: string
  count: number
}

export function SettingsModal({ open, onClose, onNotify }: SettingsModalProps) {
  const cards = useBoardStore((state) => state.cards)
  const boardLabels = useBoardStore((state) => state.labels)
  const addLabel = useBoardStore((state) => state.addLabel)
  const renameLabel = useBoardStore((state) => state.renameLabel)
  const deleteLabel = useBoardStore((state) => state.deleteLabel)
  const filters = useUiStore((state) => state.filters)
  const setLabelFilter = useUiStore((state) => state.setLabelFilter)
  const currentUser = useAuthStore((state) => state.user)

  const [activeTab, setActiveTab] = useState<'labels' | 'users' | 'audit'>('labels')

  // Labels state
  const [search, setSearch] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newLabelError, setNewLabelError] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  // Users state
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('viewer')
  const [userError, setUserError] = useState('')
  const [userSuccess, setUserSuccess] = useState('')
  const [resettingUser, setResettingUser] = useState<User | null>(null)
  const [resetNewPass, setResetNewPass] = useState('')

  // Audit state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loadingAudit, setLoadingAudit] = useState(false)

  const labels = useMemo<LabelRow[]>(() => {
    return boardLabels
      .map((name) => ({
        name,
        count: cards.filter((card) =>
          card.labels.some((label) => label.toLowerCase() === name.toLowerCase()),
        ).length,
      }))
      .sort((first, second) => {
        if (second.count !== first.count) return second.count - first.count
        return first.name.localeCompare(second.name)
      })
  }, [boardLabels, cards])

  const filteredLabels = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return labels
    return labels.filter((label) => label.name.toLowerCase().includes(query))
  }, [labels, search])

  // Load users when users tab is active
  useEffect(() => {
    if (open && activeTab === 'users' && currentUser?.role === 'admin') {
      let active = true
      api.getUsers()
        .then((res) => {
          if (active) setUsers(res.users)
        })
        .catch((err) => console.error(err))
        .finally(() => {
          if (active) setLoadingUsers(false)
        })
      return () => {
        active = false
      }
    }
  }, [open, activeTab, currentUser])

  // Load audit logs when audit tab is active
  useEffect(() => {
    if (open && activeTab === 'audit' && currentUser?.role === 'admin') {
      let active = true
      api.getAuditLogs(100)
        .then((res) => {
          if (active) setAuditLogs(res.logs)
        })
        .catch((err) => console.error(err))
        .finally(() => {
          if (active) setLoadingAudit(false)
        })
      return () => {
        active = false
      }
    }
  }, [open, activeTab, currentUser])

  function startRename(label: string) {
    setEditing(label)
    setDraft(label)
    setError('')
    setDeleting(null)
  }

  async function handleAddLabel() {
    const trimmed = newLabel.trim()
    if (!trimmed) {
      setNewLabelError('Label names cannot be empty.')
      return
    }

    const existing = labels.some((label) => label.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) {
      setNewLabelError('That label already exists.')
      return
    }

    const created = await addLabel(trimmed)
    if (!created) {
      setNewLabelError('Label names cannot be empty.')
      return
    }

    setNewLabel('')
    setNewLabelError('')
    onNotify?.(`Created label “${created}”.`)
  }

  function handleAddLabelKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleAddLabel()
    }
  }

  function cancelRename() {
    setEditing(null)
    setDraft('')
    setError('')
  }

  function saveRename(label: string) {
    const next = draft.trim()
    if (!next) {
      setError('Label names cannot be empty.')
      return
    }
    if (next.toLowerCase() === label.toLowerCase() && next === label) {
      cancelRename()
      return
    }

    const existingTarget = labels.find(
      (item) => item.name.toLowerCase() === next.toLowerCase() && item.name.toLowerCase() !== label.toLowerCase(),
    )

    renameLabel(label, next)

    if (filters.label && filters.label.toLowerCase() === label.toLowerCase()) {
      setLabelFilter(existingTarget?.name ?? next)
    }

    onNotify?.(
      existingTarget
        ? `Merged “${label}” into “${existingTarget.name}”.`
        : `Renamed label to “${next}”.`,
    )
    cancelRename()
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>, label: string) {
    if (event.key === 'Enter') {
      event.preventDefault()
      saveRename(label)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancelRename()
    }
  }

  function confirmDelete(label: string) {
    deleteLabel(label)
    if (filters.label?.toLowerCase() === label.toLowerCase()) {
      setLabelFilter(null)
    }
    onNotify?.(`Removed label “${label}”.`)
    setDeleting(null)
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setUserError('')
    setUserSuccess('')

    if (!newUsername.trim() || !newPassword) {
      setUserError('Username and password are required.')
      return
    }

    try {
      const created = await api.createUser(newUsername.trim(), newPassword, newDisplayName.trim(), newRole)
      setUsers((prev) => [...prev, created])
      setUserSuccess(`Created account for ${created.username} (${created.role}).`)
      setNewUsername('')
      setNewPassword('')
      setNewDisplayName('')
      setNewRole('viewer')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create user.'
      setUserError(msg)
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resettingUser || !resetNewPass) return
    try {
      await api.resetUserPassword(resettingUser.id, resetNewPass)
      setUserSuccess(`Password reset successfully for ${resettingUser.username}.`)
      setResettingUser(null)
      setResetNewPass('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset password.'
      setUserError(msg)
    }
  }

  async function handleDeleteUser(userId: string) {
    try {
      await api.deleteUser(userId)
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      setUserSuccess('User account removed.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete user.'
      setUserError(msg)
    }
  }

  function handleClose() {
    setEditing(null)
    setDraft('')
    setError('')
    setDeleting(null)
    setSearch('')
    setNewLabel('')
    setNewLabelError('')
    setUserError('')
    setUserSuccess('')
    setResettingUser(null)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Settings & Administration"
      description="Manage labels, user credentials, and security audit logs."
      closeOnBackdrop
      width="md"
      footer={
        <div className="flex justify-end">
          <Button variant="primary" onClick={handleClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Navigation tabs */}
        <div className="flex border-b border-[var(--color-rail)] dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('labels')}
            className={`border-b-2 px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'labels'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Labels ({labels.length})
          </button>
          {currentUser?.role === 'admin' && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className={`border-b-2 px-4 py-2 text-xs font-semibold transition ${
                  activeTab === 'users'
                    ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                User Accounts
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={`border-b-2 px-4 py-2 text-xs font-semibold transition ${
                  activeTab === 'audit'
                    ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Security Audit Logs
              </button>
            </>
          )}
        </div>

        {/* Tab 1: Labels */}
        {activeTab === 'labels' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Field label="New label" htmlFor="settings-new-label">
                <div className="flex gap-2">
                  <Input
                    id="settings-new-label"
                    value={newLabel}
                    onChange={(event) => {
                      setNewLabel(event.target.value)
                      if (newLabelError) setNewLabelError('')
                    }}
                    onKeyDown={handleAddLabelKeyDown}
                    placeholder="e.g. Design"
                    maxLength={60}
                  />
                  <Button type="button" variant="primary" onClick={handleAddLabel}>
                    Add label
                  </Button>
                </div>
              </Field>
              {newLabelError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">{newLabelError}</p>
              )}
            </div>

            <Field label="Search labels" htmlFor="settings-label-search">
              <Input
                id="settings-label-search"
                data-autofocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter labels…"
              />
            </Field>

            {labels.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  No labels yet
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Add labels from a card or above and they will appear here.
                </p>
              </div>
            ) : filteredLabels.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No labels match your search.
              </p>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {filteredLabels.map((label) => {
                  const isEditing = editing === label.name
                  const isDeleting = deleting === label.name

                  return (
                    <li
                      key={label.name.toLowerCase()}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60"
                    >
                      {isDeleting ? (
                        <div className="space-y-3">
                          <p className="text-sm text-slate-700 dark:text-slate-200">
                            Remove “{label.name}” from {label.count}{' '}
                            {label.count === 1 ? 'card' : 'cards'}?
                          </p>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => setDeleting(null)}>
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => confirmDelete(label.name)}
                            >
                              Delete label
                            </Button>
                          </div>
                        </div>
                      ) : isEditing ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'h-2.5 w-2.5 shrink-0 rounded-full',
                                getLabelDotClass(label.name),
                              )}
                            />
                            <Input
                              value={draft}
                              onChange={(event) => {
                                setDraft(event.target.value)
                                if (error) setError('')
                              }}
                              onKeyDown={(event) => handleRenameKeyDown(event, label.name)}
                              aria-label={`Rename ${label.name}`}
                              maxLength={60}
                            />
                          </div>
                          {error && (
                            <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
                          )}
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={cancelRename}>
                              Cancel
                            </Button>
                            <Button size="sm" variant="primary" onClick={() => saveRename(label.name)}>
                              Save name
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              'h-2.5 w-2.5 shrink-0 rounded-full',
                              getLabelDotClass(label.name),
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                              {label.name}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              {label.count} {label.count === 1 ? 'card' : 'cards'}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startRename(label.name)}
                            >
                              Rename
                            </Button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(null)
                                setDraft('')
                                setError('')
                                setDeleting(label.name)
                              }}
                              aria-label={`Delete ${label.name} label`}
                              title={`Delete ${label.name}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {/* Tab 2: Users Management */}
        {activeTab === 'users' && currentUser?.role === 'admin' && (
          <div className="space-y-5">
            {userError && (
              <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800">
                {userError}
              </div>
            )}
            {userSuccess && (
              <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800">
                {userSuccess}
              </div>
            )}

            {/* Create new user form */}
            <form onSubmit={handleCreateUser} className="rounded-xl border border-[var(--color-rail)] bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Create User Account
              </h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Username" htmlFor="new-user-username" hint="Required">
                  <Input
                    id="new-user-username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. jordan"
                    required
                  />
                </Field>
                <Field label="Password" htmlFor="new-user-password" hint="Min 6 chars">
                  <Input
                    id="new-user-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </Field>
                <Field label="Display Name" htmlFor="new-user-displayname">
                  <Input
                    id="new-user-displayname"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="e.g. Jordan Lee"
                  />
                </Field>
                <Field label="Role" htmlFor="new-user-role">
                  <Select
                    id="new-user-role"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                  >
                    <option value="viewer">Viewer (Read-only Kanban)</option>
                    <option value="admin">Administrator (Full control)</option>
                  </Select>
                </Field>
              </div>
              <div className="mt-3 flex justify-end">
                <Button type="submit" variant="primary" size="sm">
                  Add User
                </Button>
              </div>
            </form>

            {/* Reset Password Modal inline */}
            {resettingUser && (
              <form onSubmit={handleResetPassword} className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
                <h4 className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  Reset Password for {resettingUser.username}
                </h4>
                <div className="mt-2 flex gap-2">
                  <Input
                    type="password"
                    placeholder="New password (min 6 chars)"
                    value={resetNewPass}
                    onChange={(e) => setResetNewPass(e.target.value)}
                    required
                  />
                  <Button type="submit" variant="primary" size="sm">
                    Set Password
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setResettingUser(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {/* Users list */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Existing Accounts ({users.length})
              </h4>
              {loadingUsers ? (
                <p className="py-4 text-center text-xs text-slate-400">Loading accounts…</p>
              ) : (
                <ul className="mt-2 max-h-60 space-y-2 overflow-y-auto pr-1">
                  {users.map((u) => {
                    const isSelf = u.id === currentUser?.id
                    return (
                      <li
                        key={u.id}
                        className="flex items-center justify-between rounded-lg border border-[var(--color-rail)] bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {u.username}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.2 text-[10px] font-semibold uppercase tracking-wider ${
                                u.role === 'admin'
                                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {u.role}
                            </span>
                            {isSelf && (
                              <span className="text-[10px] text-slate-400">(You)</span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {u.displayName || 'No display name'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setResettingUser(u)
                              setResetNewPass('')
                            }}
                          >
                            Reset Password
                          </Button>
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id)}
                              className="rounded p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                              title={`Delete ${u.username}`}
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Security Audit Logs */}
        {activeTab === 'audit' && currentUser?.role === 'admin' && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Recent Security & Activity Trail
            </h4>
            {loadingAudit ? (
              <p className="py-6 text-center text-xs text-slate-400">Loading audit trail…</p>
            ) : auditLogs.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">No activity logged yet.</p>
            ) : (
              <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <li
                    key={log.id}
                    className="rounded-lg border border-[var(--color-rail)] bg-slate-50/50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-900/40"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {log.action}
                        </span>
                        <span className="rounded bg-slate-200/80 px-1 py-0.2 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          by {log.username || 'Anonymous'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {formatRelativeTime(log.createdAt)}
                      </span>
                    </div>
                    {log.details && (
                      <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                        {log.details}
                      </p>
                    )}
                    <p className="mt-0.5 text-[9px] text-slate-400">
                      IP: {log.ipAddress || 'unknown'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
