import { useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useBoardStore } from '../store/boardStore'
import { useUiStore } from '../store/uiStore'
import { cn } from '../utils/cn'
import { getLabelDotClass } from '../utils/labels'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Input'
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

  const [search, setSearch] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newLabelError, setNewLabelError] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

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

  function startRename(label: string) {
    setEditing(label)
    setDraft(label)
    setError('')
    setDeleting(null)
  }

  function handleAddLabel() {
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

    const created = addLabel(trimmed)
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

  function handleClose() {
    setEditing(null)
    setDraft('')
    setError('')
    setDeleting(null)
    setSearch('')
    setNewLabel('')
    setNewLabelError('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Settings"
      description="Manage labels used across your board."
      closeOnBackdrop
      footer={
        <div className="flex justify-end">
          <Button variant="primary" onClick={handleClose}>
            Done
          </Button>
        </div>
      }
    >
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
              Add labels from a card and they will appear here.
            </p>
          </div>
        ) : filteredLabels.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
            No labels match your search.
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
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
    </Modal>
  )
}
