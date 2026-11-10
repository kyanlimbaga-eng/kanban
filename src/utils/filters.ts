import type { Card, Filters } from '../types'

export function hasActiveFilters(filters: Filters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.priority !== null ||
    filters.label !== null
  )
}

export function cardMatchesFilters(card: Card, filters: Filters): boolean {
  const search = filters.search.trim().toLowerCase()

  if (filters.priority && card.priority !== filters.priority) return false
  if (filters.label && !card.labels.includes(filters.label)) return false

  if (!search) return true

  const haystack = [
    card.title,
    card.description,
    card.assignee,
    ...card.labels,
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(search)
}
