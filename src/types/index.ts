export type Priority = 'low' | 'medium' | 'high'

export type Theme = 'light' | 'dark'

export interface Column {
  id: string
  title: string
  order: number
}

export interface Card {
  id: string
  columnId: string
  title: string
  description: string
  priority: Priority
  /** Calendar date in `YYYY-MM-DD` format, or null when there is no due date. */
  dueDate: string | null
  labels: string[]
  assignee: string
  /** Zero-based index within the card's column. */
  position: number
}

export interface Board {
  columns: Column[]
  cards: Card[]
  labels: string[]
}

export interface CardInput {
  columnId: string
  title: string
  description: string
  priority: Priority
  dueDate: string | null
  labels: string[]
  assignee: string
}

export type CardUpdate = Partial<Omit<CardInput, 'columnId'>>

export interface Filters {
  search: string
  priority: Priority | null
  label: string | null
}

export type DragType = 'card' | 'column' | null
