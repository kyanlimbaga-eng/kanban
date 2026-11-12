/**
 * Canonical "Plan" labels.
 *
 * These labels categorize cards on the Kanban board and scope which cards a
 * non-admin account is allowed to see (see the `user_labels` table in
 * `server/db.ts`). The list is shared by the Express server and the React
 * client so both always agree on the fixed label set.
 */
export const PLAN_LABELS = [
  'AD DS',
  'GPO',
  'Hardening',
  'PKI',
  'Audit and Monitoring',
  'NAS and Sharing',
  'Drive Mapping and Scheduler',
  'Backup and Recovery',
] as const

export type PlanLabel = (typeof PLAN_LABELS)[number]

/**
 * Plan labels may be renamed (cascading to cards and account assignments)
 * but cannot be deleted, because accounts depend on them for access control.
 * Matching is case-insensitive.
 */
export function isProtectedLabel(name: string): boolean {
  const needle = name.trim().toLowerCase()
  if (!needle) return false
  return PLAN_LABELS.some((label) => label.toLowerCase() === needle)
}
