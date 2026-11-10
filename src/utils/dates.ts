import { format, isSameYear, isToday, isTomorrow, parseISO, startOfDay } from 'date-fns'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Strictly validates a `YYYY-MM-DD` string, including impossible calendar dates. */
export function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function dateFromToday(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return format(date, 'yyyy-MM-dd')
}

export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate || !isValidDateString(dueDate)) return false
  return parseISO(dueDate) < startOfDay(new Date())
}

export function isDueToday(dueDate: string | null): boolean {
  if (!dueDate || !isValidDateString(dueDate)) return false
  return isToday(parseISO(dueDate))
}

export function formatDueDate(dueDate: string): string {
  const date = parseISO(dueDate)
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return isSameYear(date, new Date())
    ? format(date, 'MMM d')
    : format(date, 'MMM d, yyyy')
}
