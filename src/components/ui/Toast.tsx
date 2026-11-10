import { cn } from '../../utils/cn'
import { AlertIcon, CheckIcon, XIcon } from './icons'

export interface ToastMessage {
  id: number
  message: string
  tone: 'success' | 'error'
}

export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastMessage
  onDismiss: () => void
}) {
  const isError = toast.tone === 'error'
  const ToastIcon = isError ? AlertIcon : CheckIcon

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex justify-center px-4">
      <div
        role={isError ? 'alert' : 'status'}
        aria-live={isError ? 'assertive' : 'polite'}
        className={cn(
          'animate-toast-in pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border p-3 text-sm shadow-xl backdrop-blur',
          isError
            ? 'border-rose-200 bg-white/95 text-rose-700 dark:border-rose-500/30 dark:bg-slate-900/95 dark:text-rose-300'
            : 'border-slate-200 bg-white/95 text-slate-700 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200',
        )}
      >
        <span
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
            isError
              ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
              : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
          )}
        >
          <ToastIcon className="h-3.5 w-3.5" />
        </span>
        <p className="min-w-0 flex-1 leading-snug">{toast.message}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="-m-1 rounded-md p-1 text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
