import { useEffect, useState } from 'react'
import { Board } from './components/Board'
import { PasscodeGate } from './components/PasscodeGate'
import { useBoardStore } from './store/boardStore'
import { useUiStore } from './store/uiStore'

function LoadingScreen() {
  return (
    <div className="flex h-dvh items-center justify-center bg-slate-100 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Loading your board…
        </p>
      </div>
    </div>
  )
}

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

function App() {
  const [hydrated, setHydrated] = useState(
    () => useBoardStore.persist.hasHydrated() && useUiStore.persist.hasHydrated(),
  )
  const theme = useUiStore((state) => state.theme)
  const adminUnlocked = useUiStore((state) => state.adminUnlocked)
  const unlockAdmin = useUiStore((state) => state.unlockAdmin)
  const pathname = normalizePath(window.location.pathname)
  const isAdminRoute = pathname === '/admin'
  const readOnly = !isAdminRoute || !adminUnlocked

  useEffect(() => {
    if (hydrated) return

    const check = () => {
      if (useBoardStore.persist.hasHydrated() && useUiStore.persist.hasHydrated()) {
        setHydrated(true)
      }
    }

    const unsubBoard = useBoardStore.persist.onFinishHydration(check)
    const unsubUi = useUiStore.persist.onFinishHydration(check)
    check()

    return () => {
      unsubBoard()
      unsubUi()
    }
  }, [hydrated])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#020617' : '#f1f5f9')
  }, [theme])

  if (!hydrated) {
    return <LoadingScreen />
  }

  if (isAdminRoute && !adminUnlocked) {
    return <PasscodeGate onUnlock={unlockAdmin} />
  }

  return <Board readOnly={readOnly} />
}

export default App
