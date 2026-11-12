import { useEffect } from 'react'
import { Board } from './components/Board'
import { LoginModal } from './components/LoginModal'
import { PasswordSetup } from './components/PasswordSetup'
import { useAuthStore } from './store/authStore'
import { useBoardStore } from './store/boardStore'
import { useUiStore } from './store/uiStore'

function LoadingScreen() {
  return (
    <div className="flex h-dvh items-center justify-center bg-slate-100 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Connecting to Flowboard LAN…
        </p>
      </div>
    </div>
  )
}

function App() {
  const user = useAuthStore((state) => state.user)
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const checkAuth = useAuthStore((state) => state.checkAuth)
  const theme = useUiStore((state) => state.theme)
  const fetchBoard = useBoardStore((state) => state.fetchBoard)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    // Skip loading the board while the sign-in or password setup page is shown.
    if (user && !user.mustChangePassword) {
      fetchBoard()
    }
  }, [user, fetchBoard])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#020617' : '#f1f5f9')
  }, [theme])

  if (isAuthLoading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <LoginModal />
  }

  // Accounts with a temporary password may only set their own password
  if (user.mustChangePassword) {
    return <PasswordSetup />
  }

  // Enforce Role-Based Access Control: Admin has full access, Viewers are view-only
  const readOnly = user.role !== 'admin'

  return <Board readOnly={readOnly} />
}

export default App
