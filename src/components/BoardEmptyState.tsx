import { Button } from './ui/Button'
import { PlusIcon } from './ui/icons'

export function BoardEmptyState({ onAddColumn }: { onAddColumn: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <svg
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
            className="h-8 w-8 text-slate-300 dark:text-slate-700"
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
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Your board is wide open
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Columns are the stages your work moves through. Add your first one and
          start planning.
        </p>
        <Button variant="primary" onClick={onAddColumn} className="mt-5">
          <PlusIcon className="h-4 w-4" />
          Add your first column
        </Button>
      </div>
    </div>
  )
}
