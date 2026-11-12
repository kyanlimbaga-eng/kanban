import { useState, type FormEvent } from 'react'
import { useAuthStore } from '../store/authStore'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Input'
import { LogoMark } from './ui/icons'

/**
 * Shown when an account still uses the temporary password an administrator
 * issued for it. The server blocks every board endpoint until the password is
 * replaced, so this screen is the only thing the account can reach.
 */
export function PasswordSetup() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const user = useAuthStore((state) => state.user)
  const setPassword = useAuthStore((state) => state.setPassword)
  const logout = useAuthStore((state) => state.logout)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError('')

    if (!currentPassword || !newPassword) return
    if (newPassword.length < 6) {
      setLocalError('Your new password must be at least 6 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setLocalError('The new passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      const message = await setPassword(currentPassword, newPassword)
      if (message) setLocalError(message)
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
              Set your password
            </h1>
            <p className="text-xs text-[color:rgb(31_41_51/0.7)] dark:text-slate-400">
              First sign-in setup
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-[color:rgb(31_41_51/0.8)] dark:text-slate-300">
          {user ? (
            <>
              You are signed in as <strong>@{user.username}</strong>. Replace the
              temporary password to continue to the board.
            </>
          ) : (
            'Replace the temporary password to continue to the board.'
          )}
        </p>

        {localError && (
          <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800">
            {localError}
          </div>
        )}

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <Field
            label="Temporary password"
            htmlFor="setup-current-password"
            hint="Given by your administrator"
          >
            <Input
              id="setup-current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value)
                if (localError) setLocalError('')
              }}
              autoComplete="current-password"
              placeholder="Temporary password"
              data-autofocus
              required
            />
          </Field>

          <Field label="New password" htmlFor="setup-new-password" hint="Min 6 characters">
            <Input
              id="setup-new-password"
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value)
                if (localError) setLocalError('')
              }}
              autoComplete="new-password"
              placeholder="New password"
              required
            />
          </Field>

          <Field label="Confirm new password" htmlFor="setup-confirm-password">
            <Input
              id="setup-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                if (localError) setLocalError('')
              }}
              autoComplete="new-password"
              placeholder="Repeat the new password"
              required
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            className="w-full justify-center py-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving…' : 'Set password & continue'}
          </Button>
        </form>

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
