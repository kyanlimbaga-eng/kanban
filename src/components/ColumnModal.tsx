import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Input'
import { Modal } from './ui/Modal'

interface ColumnModalProps {
  mode: 'add' | 'rename'
  initialTitle?: string
  onClose: () => void
  onSubmit: (title: string) => void
}

export function ColumnModal({
  mode,
  initialTitle = '',
  onClose,
  onSubmit,
}: ColumnModalProps) {
  const formId = useId()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(initialTitle)
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Columns need a name.')
      inputRef.current?.focus()
      return
    }
    onSubmit(trimmed)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'add' ? 'Add column' : 'Rename column'}
      description={
        mode === 'add'
          ? 'Give the new stage of work a short, clear name.'
          : 'Cards in this column keep their place.'
      }
      closeOnBackdrop
      width="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary">
            {mode === 'add' ? 'Add column' : 'Save name'}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit}>
        <Field
          label="Column name"
          htmlFor={inputId}
          hint="Required"
          error={error}
        >
          <Input
            ref={inputRef}
            id={inputId}
            data-autofocus
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              if (error) setError('')
            }}
            placeholder="e.g. Backlog"
            maxLength={60}
            aria-invalid={Boolean(error)}
          />
        </Field>
      </form>
    </Modal>
  )
}
