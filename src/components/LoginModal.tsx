import { useState, type FormEvent } from 'react'
import { useAuthStore } from '../store/authStore'
import { PLAN_LABELS } from '../../shared/planLabels'
import { cn } from '../utils/cn'
import { getLabelClasses } from '../utils/labels'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Input'
import { LogoMark } from './ui/icons'

export function LoginModal() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const login = useAuthStore((state) => state.login)
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)
  const error = useAuthStore((state) => state.error)
  const clearError = useAuthStore((state) => state.clearError)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!username.trim() || !password) return

    setIsSubmitting(true)
    try {
      await login(username.trim(), password)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--color-paper)] px-4 text-[var(--color-ink)] dark:bg-slate-950 dark:text-slate-100">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-rail)] bg-[var(--color-surface)] p-7 shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <LogoMark className="h-10 w-10 shrink-0 rounded-lg ring-1 ring-[var(--color-rail)] dark:ring-slate-800" />
          <div>
            <h1 className="font-serif text-2xl font-semibold text-[var(--color-ink)] dark:text-white">
              Flowboard LAN
            </h1>
            <p className="text-xs text-[color:rgb(31_41_51/0.7)] dark:text-slate-400">
              Real-Time Team Project Management
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-[color:rgb(31_41_51/0.8)] dark:text-slate-300">
          Sign in to collaborate with your team across the local network.
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800">
            {error}
          </div>
        )}

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <Field label="Username" htmlFor="login-username">
            <Input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                if (error) clearError()
              }}
              autoComplete="username"
              placeholder="Username"
              data-autofocus
              required
            />
          </Field>

          <Field label="Password" htmlFor="login-password">
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) clearError()
              }}
              autoComplete="current-password"
              placeholder="Password"
              required
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            className="w-full justify-center py-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in to board'}
          </Button>
        </form>

        {/* Active session: offer to end it */}
        {user && (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-[var(--color-rail)] bg-slate-50/70 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Signed in
              </p>
              <p className="truncate text-sm font-medium text-[var(--color-ink)] dark:text-slate-100">
                {user.displayName || user.username}
                <span className="ml-1 text-[11px] font-normal text-slate-400 dark:text-slate-500">
                  @{user.username} · {user.role}
                </span>
              </p>
            </div>
            <Button variant="dangerGhost" size="sm" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        )}

        {/* How task visibility is scoped */}
        <div className="mt-5 border-t border-[var(--color-rail)] pt-4 dark:border-slate-800">
          <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Task visibility by label
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Each account is assigned one or more labels and only sees the Kanban cards carrying them.
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {PLAN_LABELS.map((label) => (
              <span
                key={label}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset',
                  getLabelClasses(label),
                )}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
