import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Input'

interface PasscodeGateProps {
  onUnlock: (passcode: string) => boolean
}

export function PasscodeGate({ onUnlock }: PasscodeGateProps) {
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const ok = onUnlock(passcode.trim())
    if (!ok) {
      setError('Wrong passcode.')
      return
    }
    setError('')
    setPasscode('')
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--color-paper)] px-4 text-[var(--color-ink)] dark:bg-slate-950 dark:text-slate-100">
      <div className="w-full max-w-sm rounded-md border border-[var(--color-rail)] bg-[var(--color-surface)] p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="font-serif text-2xl font-semibold">Admin access</h1>
        <p className="mt-2 text-sm text-[color:rgb(31_41_51/0.7)] dark:text-slate-400">
          Enter the admin passcode to open the full board.
        </p>
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <Field label="Passcode" htmlFor="admin-passcode" error={error} hint="Text and numbers">
            <Input
              id="admin-passcode"
              type="password"
              value={passcode}
              onChange={(event) => {
                setPasscode(event.target.value)
                if (error) setError('')
              }}
              autoComplete="current-password"
              placeholder="Enter passcode"
              data-autofocus
            />
          </Field>
          <Button type="submit" variant="primary" className="w-full">
            Unlock admin
          </Button>
        </form>
        <p className="mt-4 text-xs text-[color:rgb(31_41_51/0.55)] dark:text-slate-500">
          Student view is at <code>/</code>.
        </p>
      </div>
    </div>
  )
}
