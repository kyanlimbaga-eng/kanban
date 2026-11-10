import { Button } from './ui/Button'
import { PlusIcon } from './ui/icons'

interface BoardEmptyStateProps {
  readOnly: boolean
  onAddColumn: () => void
}

export function BoardEmptyState({ readOnly, onAddColumn }: BoardEmptyStateProps) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-md border border-[var(--color-rail)] bg-[var(--color-surface)] shadow-[0_1px_0_rgba(31,41,51,0.04)] dark:border-slate-800 dark:bg-slate-900">
          <svg
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
            className="h-8 w-8 text-[color:rgb(31_41_51/0.28)] dark:text-slate-700"
          >
            <rect
              x="5"
              y="8"
              width="10"
              height="32"
              rx="3"
              stroke="currentColor"
              strokeWidth="2.5"
            />
            <rect
              x="19"
              y="8"
              width="10"
              height="22"
              rx="3"
              stroke="currentColor"
              strokeWidth="2.5"
            />
            <rect
              x="33"
              y="8"
              width="10"
              height="27"
              rx="3"
              stroke="currentColor"
              strokeWidth="2.5"
            />
          </svg>
        </div>
        <h2 className="font-serif text-xl font-semibold text-[var(--color-ink)] dark:text-white">
          Your board is wide open
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[color:rgb(31_41_51/0.68)] dark:text-slate-400">
          {readOnly
            ? 'No columns yet. This board is view only.'
            : 'Columns are the stages your work moves through. Add your first one and start planning.'}
        </p>
        {!readOnly && (
          <Button variant="primary" onClick={onAddColumn} className="mt-5">
            <PlusIcon className="h-4 w-4" />
            Add your first column
          </Button>
        )}
      </div>
    </div>
  )
}
