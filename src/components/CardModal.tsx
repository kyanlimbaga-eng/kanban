import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { api } from '../services/api'
import { socket } from '../services/socket'
import { useAuthStore } from '../store/authStore'
import { useBoardStore } from '../store/boardStore'
import type { Card as CardModel, Comment, Priority } from '../types'
import { cn } from '../utils/cn'
import { formatRelativeTime } from '../utils/dates'
import { getLabelClasses, normalizeLabels } from '../utils/labels'
import { PRIORITIES, PRIORITY_LABELS } from '../utils/priority'
import { Button } from './ui/Button'
import { Field, Input, Select, Textarea } from './ui/Input'
import { Modal } from './ui/Modal'
import { CopyIcon, TrashIcon, XIcon } from './ui/icons'

interface CardModalProps {
  readOnly: boolean
  columnId: string
  columnTitle: string
  card?: CardModel
  onClose: () => void
}

export function CardModal({
  readOnly,
  columnId,
  columnTitle,
  card,
  onClose,
}: CardModalProps) {
  const addCard = useBoardStore((state) => state.addCard)
  const duplicateCard = useBoardStore((state) => state.duplicateCard)
  const updateCard = useBoardStore((state) => state.updateCard)
  const deleteCard = useBoardStore((state) => state.deleteCard)
  const boardLabels = useBoardStore((state) => state.labels)
  const currentUser = useAuthStore((state) => state.user)

  const formId = useId()
  const titleId = useId()
  const descriptionId = useId()
  const priorityId = useId()
  const dueDateId = useId()
  const assigneeId = useId()
  const labelsId = useId()
  const titleRef = useRef<HTMLInputElement>(null)

  // Non-admin accounts only get the writable Activity & Updates tab, so they
  // land there instead of on a details tab they cannot edit.
  const [activeTab, setActiveTab] = useState<'details' | 'comments'>(
    readOnly ? 'comments' : 'details',
  )
  const [title, setTitle] = useState(card?.title ?? '')
  const [description, setDescription] = useState(card?.description ?? '')
  const [priority, setPriority] = useState<Priority>(card?.priority ?? 'medium')
  const [dueDate, setDueDate] = useState(card?.dueDate ?? '')
  const [labels, setLabels] = useState<string[]>(card?.labels ?? [])
  const [assignee, setAssignee] = useState(card?.assignee ?? '')
  const [titleError, setTitleError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Comments state
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [loadingComments, setLoadingComments] = useState(() => Boolean(card))

  const availableLabels = boardLabels.filter(
    (label) => !labels.some((selected) => selected.toLowerCase() === label.toLowerCase()),
  )

  // Fetch comments when card is opened
  useEffect(() => {
    if (!card) return
    let active = true

    api.getComments(card.id)
      .then((res) => {
        if (active) setComments(res.comments)
      })
      .catch((err) => console.error('Failed to load comments:', err))
      .finally(() => {
        if (active) setLoadingComments(false)
      })

    // Listen to real-time comment events
    const unsub = socket.onEvent((event) => {
      if (event.type === 'COMMENT_ADDED') {
        const comment = event.payload as Comment
        if (comment.cardId === card.id) {
          setComments((prev) => {
            if (prev.some((c) => c.id === comment.id)) return prev
            return [...prev, comment]
          })
        }
      } else if (event.type === 'COMMENT_DELETED') {
        const { cardId, commentId } = event.payload as { cardId: string; commentId: string }
        if (cardId === card.id) {
          setComments((prev) => prev.filter((c) => c.id !== commentId))
        }
      } else if (event.type === 'CARD_DELETED') {
        const { id } = event.payload as { id: string }
        if (id === card.id) {
          onClose()
        }
      }
    })

    return () => {
      active = false
      unsub()
    }
  }, [card, onClose])

  async function handleAddComment(e: FormEvent) {
    e.preventDefault()
    if (!card || !commentText.trim() || isSubmittingComment) return

    setIsSubmittingComment(true)
    try {
      const newComment = await api.addComment(card.id, commentText.trim())
      setComments((prev) => {
        if (prev.some((c) => c.id === newComment.id)) return prev
        return [...prev, newComment]
      })
      setCommentText('')
    } catch (err) {
      console.error('Failed to post comment:', err)
    } finally {
      setIsSubmittingComment(false)
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!card) return
    try {
      await api.deleteComment(card.id, commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch (err) {
      console.error('Failed to delete comment:', err)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (readOnly || isSubmitting || isDeleting) {
      if (readOnly) onClose()
      return
    }
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setTitleError('Give this card a title.')
      titleRef.current?.focus()
      return
    }

    const payload = {
      title: trimmedTitle,
      description,
      priority,
      dueDate: dueDate || null,
      labels: normalizeLabels(labels),
      assignee,
    }

    setIsSubmitting(true)
    setSubmitError('')
    try {
      if (card) {
        await updateCard(card.id, payload)
      } else {
        await addCard({ columnId, ...payload })
      }
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save changes.'
      setSubmitError(msg)
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!card || isDeleting || isSubmitting) return
    setIsDeleting(true)
    setSubmitError('')
    try {
      await deleteCard(card.id)
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete card.'
      setSubmitError(msg)
      setIsDeleting(false)
    }
  }

  async function handleDuplicate() {
    if (!card || isSubmitting || isDeleting) return
    setIsSubmitting(true)
    setSubmitError('')
    try {
      await duplicateCard(card.id)
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to duplicate card.'
      setSubmitError(msg)
      setIsSubmitting(false)
    }
  }

  const footer = readOnly ? (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500 dark:text-slate-400">
        Updates only — task details are managed by an administrator.
      </span>
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    </div>
  ) : confirmingDelete ? (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
        Delete “{card?.title}” for good?
      </p>
      <div className="flex gap-2">
        <Button size="sm" disabled={isDeleting} onClick={() => setConfirmingDelete(false)}>
          Keep card
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={isDeleting}
          onClick={handleDelete}
        >
          {isDeleting ? 'Deleting…' : 'Delete card'}
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-between gap-2">
      <div>
        {card && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="dangerGhost"
              size="sm"
              disabled={isSubmitting || isDeleting}
              onClick={() => setConfirmingDelete(true)}
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={isSubmitting || isDeleting}
              onClick={handleDuplicate}
              title="Duplicate this task"
            >
              <CopyIcon className="h-3.5 w-3.5" />
              Duplicate
            </Button>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={isSubmitting || isDeleting} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form={formId} variant="primary" disabled={isSubmitting || isDeleting}>
          {isSubmitting
            ? (card ? 'Saving…' : 'Adding…')
            : (card ? 'Save changes' : 'Add card')}
        </Button>
      </div>
    </div>
  )

  return (
    <Modal
      open
      onClose={onClose}
      title={card ? (readOnly ? 'View card' : 'Edit card') : 'New card'}
      description={`in ${columnTitle}`}
      footer={footer}
    >
      {/* Navigation tabs: Details vs. Updates / Comments (Monday.com style).
          Non-admin accounts only get the Activity & Updates tab, which is the
          one place they can write. */}
      {card && (
        <div className="mb-4 flex border-b border-[var(--color-rail)] dark:border-slate-800">
          {!readOnly && (
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`flex-1 border-b-2 py-2 text-center text-xs font-semibold transition ${
                activeTab === 'details'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Task Details
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('comments')}
            className={`flex-1 border-b-2 py-2 text-center text-xs font-semibold transition ${
              activeTab === 'comments'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Activity & Updates {comments.length > 0 && `(${comments.length})`}
          </button>
        </div>
      )}

      {submitError && (
        <div className="mb-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800">
          {submitError}
        </div>
      )}

      {activeTab === 'details' ? (
        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
          <Field label="Title" htmlFor={titleId} hint="Required" error={titleError}>
            <Input
              ref={titleRef}
              id={titleId}
              data-autofocus
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
                if (titleError) setTitleError('')
                if (submitError) setSubmitError('')
              }}
              placeholder="What needs doing?"
              maxLength={200}
              aria-invalid={Boolean(titleError)}
              disabled={readOnly}
            />
          </Field>

          <Field label="Description" htmlFor={descriptionId}>
            <Textarea
              id={descriptionId}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add a little context, links, or acceptance criteria…"
              rows={4}
              disabled={readOnly}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Priority" htmlFor={priorityId}>
              <Select
                id={priorityId}
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
                disabled={readOnly}
              >
                {PRIORITIES.map((option) => (
                  <option key={option} value={option}>
                    {PRIORITY_LABELS[option]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Due date" htmlFor={dueDateId}>
              <Input
                id={dueDateId}
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                disabled={readOnly}
              />
            </Field>
          </div>

          <Field label="Labels" htmlFor={labelsId} hint="Choose from your labels">
            <div className="space-y-2">
              {labels.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {labels.map((label) => (
                    <span
                      key={label}
                      className={cn(
                        'inline-flex max-w-[190px] items-center gap-0.5 rounded-full py-0.5 pr-0.5 pl-2 text-[11px] font-medium ring-1 ring-inset',
                        getLabelClasses(label),
                      )}
                    >
                      <span className="truncate">{label}</span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            setLabels((current) =>
                              current.filter((item) => item.toLowerCase() !== label.toLowerCase()),
                            )
                          }
                          aria-label={`Remove ${label} label`}
                          className="rounded-full p-0.5 opacity-70 transition hover:bg-black/10 hover:opacity-100 focus-visible:outline-none dark:hover:bg-white/10"
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}

              {!readOnly && availableLabels.length > 0 ? (
                <Select
                  id={labelsId}
                  value=""
                  onChange={(event) => {
                    const selected = event.target.value
                    if (!selected) return
                    setLabels((current) => normalizeLabels([...current, selected]))
                  }}
                  aria-label="Add a label"
                >
                  <option value="">Add a label…</option>
                  {availableLabels.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </Select>
              ) : !readOnly ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  No labels available. Create them in Settings.
                </p>
              ) : labels.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">No labels.</p>
              ) : null}
            </div>
          </Field>

          <Field label="Assignee" htmlFor={assigneeId}>
            <Input
              id={assigneeId}
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              placeholder="e.g. Alex Morgan"
              maxLength={100}
              disabled={readOnly}
            />
          </Field>
        </form>
      ) : (
        /* Monday.com style activity & comments feed */
        <div className="space-y-4">
          <form onSubmit={handleAddComment} className="space-y-2">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write an update or reply for the team on this task…"
              rows={3}
              required
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!commentText.trim() || isSubmittingComment}
              >
                {isSubmittingComment ? 'Posting…' : 'Post update'}
              </Button>
            </div>
          </form>

          <div className="mt-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Team Updates ({comments.length})
            </h4>

            {loadingComments ? (
              <p className="py-4 text-center text-xs text-slate-400">Loading updates…</p>
            ) : comments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center dark:border-slate-800">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  No updates yet. Post the first update to start collaborating!
                </p>
              </div>
            ) : (
              <ul className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
                {comments.map((c) => {
                  const canDelete = currentUser?.role === 'admin' || c.userId === currentUser?.id
                  return (
                    <li
                      key={c.id}
                      className="rounded-lg border border-[var(--color-rail)] bg-slate-50/60 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/60"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {c.displayName || c.username}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatRelativeTime(c.createdAt)}
                          </span>
                        </div>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(c.id)}
                            className="rounded p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                            title="Delete comment"
                          >
                            <TrashIcon className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                        {c.content}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
