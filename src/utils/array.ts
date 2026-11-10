/** Moves an item within an array without mutating the original. */
export function arrayMove<T>(items: T[], from: number, to: number): T[] {
  const next = [...items]
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) {
    return next
  }
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Returns a copy sorted by numeric `position`. */
export function sortByPosition<T extends { position: number }>(items: T[]): T[] {
  return [...items].sort((first, second) => first.position - second.position)
}
