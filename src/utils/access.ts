import type { Card, User } from '../types'

/**
 * Whether the signed-in account may move this card between columns.
 *
 * Administrators may move any card. Label-scoped accounts may move the cards
 * they are allowed to see — cards carrying one of their assigned labels — so
 * they can move work through the board (To Do → In Progress → Review → Done)
 * without gaining access to anything else. The server enforces the same rule.
 */
export function canMoveCard(user: User | null, card: Pick<Card, 'labels'>): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  const allowed = new Set(user.labels.map((label) => label.toLowerCase()))
  return (card.labels || []).some((label) => allowed.has(label.toLowerCase()))
}
