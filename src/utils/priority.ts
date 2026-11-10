import type { Priority } from '../types'

export const PRIORITIES: Priority[] = ['low', 'medium', 'high']

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}
