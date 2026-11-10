import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Card as CardModel, Priority } from '../types'
import { useBoardStore } from '../store/boardStore'
import { cn } from '../utils/cn'
import { getLabelClasses, normalizeLabels } from '../utils/labels'
import { PRIORITIES, PRIORITY_LABELS } from '../utils/priority'
import { Button } from './ui/Button'
import { Field, Input, Select, Textarea } from './ui/Input'
import { Modal } from './ui/Modal'
import { TrashIcon, XIcon } from './ui/icons'

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
  const updateCard = useBoardStore((state) => state.updateCard)
  const deleteCard = useBoardStore((state) => state.deleteCard)
  const boardLabels = useBoardStore((state) => state.labels)

  const formId = useId()
  const titleId = useId()
  const descriptionId = useId()
  const priorityId = useId()
  const dueDateId = useId()
  const assigneeId = useId()
  const labelsId = useId()
  const titleRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState(card?.title ?? '')
  const [description, setDescription] = useState(card?.description ?? '')
  const [priority, setPriority] = useState<Priority>(card?.priority ?? 'medium')
  const [dueDate, setDueDate] = useState(card?.dueDate ?? '')
  const [labels, setLabels] = useState<string[]>(card?.labels ?? [])
  const [assignee, setAssignee] = useState(card?.assignee ?? '')
  const [titleError, setTitleError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const availableLabels = boardLabels.filter(
    (label) => !labels.some((selected) => selected.toLowerCase() === label.toLowerCase()),
  )

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (readOnly) {
      onClose()
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

    if (card) {
      updateCard(card.id, payload)
    } else {
      addCard({ columnId, ...payload })
    }
    onClose()
  }

  const footer = readOnly ? (
    <div className="flex items-center justify-end">
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
        <Button size="sm" onClick={() => setConfirmingDelete(false)}>
          Keep card
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            if (card) deleteCard(card.id)
            onClose()
          }}
        >
          Delete card
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-between gap-2">
      <div>
        {card && (
          <Button
            variant="dangerGhost"
            size="sm"
            onClick={() => setConfirmingDelete(true)}
          >
            <TrashIcon className="h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form={formId} variant="primary">
          {card ? 'Save changes' : 'Add card'}
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
    </Modal>
  )
}
