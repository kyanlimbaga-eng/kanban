const LABEL_STYLES = [
  'bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/20',
  'bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/20',
  'bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20',
  'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20',
  'bg-cyan-50 text-cyan-700 ring-cyan-600/15 dark:bg-cyan-400/10 dark:text-cyan-300 dark:ring-cyan-400/20',
] as const

const LABEL_DOT_STYLES = [
  'bg-sky-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-rose-500',
  'bg-cyan-500',
] as const

function getLabelStyleIndex(label: string): number {
  let hash = 0
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) | 0
  }
  return Math.abs(hash) % LABEL_STYLES.length
}

/** Assigns a stable color to a label by hashing its name. */
export function getLabelClasses(label: string): string {
  return LABEL_STYLES[getLabelStyleIndex(label)]
}

/** Returns a stable dot/background class for a label. */
export function getLabelDotClass(label: string): string {
  return LABEL_DOT_STYLES[getLabelStyleIndex(label)]
}

/** Trims, removes empties, and de-duplicates labels case-insensitively. */
export function normalizeLabels(labels: string[]): string[] {
  const result: string[] = []
  for (const label of labels) {
    const trimmed = label.trim()
    if (
      trimmed &&
      !result.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())
    ) {
      result.push(trimmed)
    }
  }
  return result
}
