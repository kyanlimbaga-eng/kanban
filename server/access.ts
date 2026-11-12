import { getUserLabels } from './db'
import type { AuthenticatedUser } from './auth'

/**
 * Returns the labels an account may see, or `null` when the account has
 * unrestricted access (administrators always see every card and label).
 */
export function getAllowedLabels(user: AuthenticatedUser): string[] | null {
  if (user.role === 'admin') return null
  return user.labels
}

/**
 * Core visibility check: does a card carrying `cardLabels` fall within the
 * allowed label set? `allowed === null` means unrestricted access.
 * Matching is case-insensitive and a card is visible when it carries at
 * least one allowed label (cards with no allowed label stay hidden).
 */
export function labelsAllowCard(allowed: string[] | null, cardLabels: string[]): boolean {
  if (allowed === null) return true
  const allowedSet = new Set(allowed.map((label) => label.toLowerCase()))
  return cardLabels.some((label) => allowedSet.has(label.toLowerCase()))
}

/** Visibility check for an authenticated request. */
export function canSeeCard(user: AuthenticatedUser, cardLabels: string[]): boolean {
  return labelsAllowCard(getAllowedLabels(user), cardLabels)
}

/**
 * Visibility check using a fresh read of the account's labels from the
 * database. The WebSocket broadcaster uses this because a connected
 * client's label snapshot can go stale when an admin changes the account's
 * labels while the socket stays open.
 */
export function canSeeCardAs(userId: string, role: string, cardLabels: string[]): boolean {
  if (role === 'admin') return true
  return labelsAllowCard(getUserLabels(userId), cardLabels)
}

/** Parses the JSON `labels` column of a card row into a string array. */
export function parseCardLabels(raw: string | null | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed.filter((label): label is string => typeof label === 'string') : []
  } catch {
    return []
  }
}
