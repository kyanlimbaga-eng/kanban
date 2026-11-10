import type { Filters, Priority } from '../types'
import { hasActiveFilters } from '../utils/filters'
import { PRIORITIES, PRIORITY_LABELS } from '../utils/priority'
import { Button } from './ui/Button'
import { Input, Select } from './ui/Input'
import { PlusIcon, SearchIcon, XIcon } from './ui/icons'

interface FilterBarProps {
  filters: Filters
  labelOptions: string[]
  visibleCount: number
  totalCount: number
  onSearchChange: (value: string) => void
  onPriorityChange: (priority: Priority | null) => void
  onLabelChange: (label: string | null) => void
  onClearFilters: () => void
  onAddColumn: () => void
}

export function FilterBar({
  filters,
  labelOptions,
  visibleCount,
  totalCount,
  onSearchChange,
  onPriorityChange,
  onLabelChange,
  onClearFilters,
  onAddColumn,
}: FilterBarProps) {
  const active = hasActiveFilters(filters)

  return (
    <div className="shrink-0 border-b border-[var(--color-rail)] bg-[color:rgb(246_244_239/0.92)] px-4 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/50 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[170px] flex-1 sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[color:rgb(31_41_51/0.45)] dark:text-slate-400" />
          <Input
            type="text"
            role="searchbox"
            value={filters.search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search cards…"
            title="Search titles, descriptions, labels, and assignees"
            aria-label="Search cards"
            className="h-9 pr-9 pl-9"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-[color:rgb(31_41_51/0.5)] transition hover:bg-[var(--color-rail)]/60 hover:text-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="w-[140px]">
          <Select
            value={filters.priority ?? ''}
            onChange={(event) =>
              onPriorityChange(
                event.target.value ? (event.target.value as Priority) : null,
              )
            }
            aria-label="Filter by priority"
            className="h-9"
          >
            <option value="">All priorities</option>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]} priority
              </option>
            ))}
          </Select>
        </div>

        <div className="w-[140px]">
          <Select
            value={filters.label ?? ''}
            onChange={(event) => onLabelChange(event.target.value || null)}
            aria-label="Filter by label"
            disabled={labelOptions.length === 0}
            className="h-9"
          >
            <option value="">All labels</option>
            {labelOptions.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        {active && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-9"
          >
            <XIcon className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}

        <span className="hidden text-xs whitespace-nowrap text-[color:rgb(31_41_51/0.55)] lg:inline dark:text-slate-500">
          {active
            ? `${visibleCount} of ${totalCount} cards`
            : `${totalCount} ${totalCount === 1 ? 'card' : 'cards'}`}
        </span>

        <Button
          variant="primary"
          size="sm"
          onClick={onAddColumn}
          className="ml-auto h-9"
        >
          <PlusIcon className="h-4 w-4" />
          Add column
        </Button>
      </div>
    </div>
  )
}
