import { useState, type FormEvent } from 'react'
import { useAuthStore } from '../store/authStore'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Input'
import { LogoMark } from './ui/icons'

export function LoginModal() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const login = useAuthStore((state) => state.login)
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

  function fillPreset(u: string, p: string) {
    setUsername(u)
    setPassword(p)
    clearError()
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
              placeholder="e.g. admin or viewer"
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
              placeholder="Enter your password"
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

        <div className="mt-6 border-t border-[var(--color-rail)] pt-4 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Quick sign-in credentials:
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => fillPreset('admin', '4dmin@2026!')}
              className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300"
            >
              <span className="font-semibold">Admin:</span> admin / 4dmin@2026!
            </button>
            <button
              type="button"
              onClick={() => fillPreset('viewer', 'viewer123')}
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            >
              <span className="font-semibold">Viewer:</span> viewer / viewer123
            </button>
          </div>
          <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
            • Admins have full editing permissions.<br />
            • Viewers have view-only board permissions with comment collaboration.
          </p>
        </div>
      </div>
    </div>
  )
}
