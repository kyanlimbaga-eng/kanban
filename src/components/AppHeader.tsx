import { useUiStore } from '../store/uiStore'
import { Button } from './ui/Button'
import {
  DownloadIcon,
  LogoMark,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  UploadIcon,
} from './ui/icons'

interface AppHeaderProps {
  onExport: () => void
  onImportClick: () => void
  onSettingsClick: () => void
  settingsDisabled?: boolean
}

export function AppHeader({
  onExport,
  onImportClick,
  onSettingsClick,
  settingsDisabled = false,
}: AppHeaderProps) {
  const theme = useUiStore((state) => state.theme)
  const toggleTheme = useUiStore((state) => state.toggleTheme)

  return (
    <header className="shrink-0 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <LogoMark className="h-9 w-9 shrink-0 rounded-xl shadow-sm" />
        <div className="min-w-0">
          <h1 className="truncate text-[15px] leading-tight font-semibold tracking-tight text-slate-900 dark:text-white">
            Flowboard
          </h1>
          <p className="hidden text-[11px] text-slate-500 sm:block dark:text-slate-400">
            A calm place to plan your work
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExport}
            aria-label="Export board as JSON"
            title="Export board as JSON"
            className="h-8"
          >
            <DownloadIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onImportClick}
            aria-label="Import board from JSON"
            title="Import board from JSON"
            className="h-8"
          >
            <UploadIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettingsClick}
            disabled={settingsDisabled}
            aria-label="Open settings"
            title={settingsDisabled ? 'Close the card editor first' : 'Open settings'}
            className="h-8 w-8"
          >
            <SettingsIcon className="h-4 w-4" />
          </Button>
          <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-800" />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={
              theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
            title={
              theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
            className="h-8 w-8"
          >
            {theme === 'dark' ? (
              <SunIcon className="h-4 w-4" />
            ) : (
              <MoonIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  )
}
