export type Priority = 'low' | 'medium' | 'high'

export type Theme = 'light' | 'dark'

export type UserRole = 'admin' | 'viewer'

export interface User {
  id: string
  username: string
  displayName: string
  role: UserRole
}

export interface Comment {
  id: string
  cardId: string
  userId: string
  username: string
  displayName?: string
  content: string
  createdAt: string
}

export interface AuditLog {
  id: string
  userId: string | null
  username: string | null
  action: string
  entityType: string | null
  entityId: string | null
  details: string | null
  ipAddress: string | null
  createdAt: string
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

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
  version?: number
  createdBy?: string | null
  updatedAt?: string
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

export type CardUpdate = Partial<Omit<CardInput, 'columnId'>> & {
  version?: number
}

export interface Filters {
  search: string
  priority: Priority | null
  label: string | null
}

export type DragType = 'card' | 'column' | null
