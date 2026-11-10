import type { Board, Card, Column, Priority } from '../types'
import { isValidDateString, todayISO } from './dates'
import { normalizeLabels } from './labels'
import { PRIORITIES } from './priority'

interface ExportPayload {
  app: string
  version: number
  exportedAt: string
  board: Board
}

export interface ParsedImport {
  board: Board
  columnCount: number
  cardCount: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(
  value: unknown,
  field: string,
  { allowEmpty = false } = {},
): string {
  if (typeof value !== 'string') {
    throw new Error(`Import failed: ${field} must be a string.`)
  }
  const trimmed = value.trim()
  if (!allowEmpty && !trimmed) {
    throw new Error(`Import failed: ${field} cannot be empty.`)
  }
  return trimmed
}

function readPriority(value: unknown): Priority {
  if (typeof value === 'string' && PRIORITIES.includes(value as Priority)) {
    return value as Priority
  }
  throw new Error(
    `Import failed: card priority must be one of ${PRIORITIES.join(', ')}.`,
  )
}

function readDueDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !isValidDateString(value)) {
    throw new Error('Import failed: due dates must use the YYYY-MM-DD format.')
  }
  return value
}

function readLabels(value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    throw new Error('Import failed: card labels must be an array.')
  }

  const labels: string[] = []
  for (const label of value) {
    if (typeof label !== 'string') {
      throw new Error('Import failed: every label must be a string.')
    }
    const trimmed = label.trim()
    if (
      trimmed &&
      !labels.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())
    ) {
      labels.push(trimmed)
    }
  }
  return labels
}

/**
 * Accepts either a Flowboard export (`{ board: ... }`) or a raw board object.
 * Returns a normalized copy so malformed references and positions never reach the store.
 */
export function parseBoardJson(text: string): ParsedImport {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Import failed: that file is not valid JSON.')
  }

  const root =
    isRecord(data) && isRecord(data.board) ? data.board : (data as unknown)

  if (!isRecord(root)) {
    throw new Error('Import failed: the file does not contain board data.')
  }
  if (!Array.isArray(root.columns)) {
    throw new Error('Import failed: board data is missing a columns array.')
  }
  if (!Array.isArray(root.cards)) {
    throw new Error('Import failed: board data is missing a cards array.')
  }

  const columnIds = new Set<string>()
  const columns = root.columns.map((raw, index): Column => {
    if (!isRecord(raw)) {
      throw new Error(`Import failed: column ${index + 1} is not an object.`)
    }
    const id = readString(raw.id, `column ${index + 1} id`)
    const title = readString(raw.title, `column ${index + 1} title`)
    if (columnIds.has(id)) {
      throw new Error(`Import failed: duplicate column id "${id}".`)
    }
    columnIds.add(id)
    const order =
      typeof raw.order === 'number' && Number.isFinite(raw.order)
        ? raw.order
        : index
    return { id, title, order }
  })

  const sortedColumns = [...columns].sort(
    (first, second) => first.order - second.order,
  )
  const normalizedColumns = sortedColumns.map((column, index) => ({
    ...column,
    order: index,
  }))

  const cardIds = new Set<string>()
  const cards = root.cards.map((raw, index): Card => {
    if (!isRecord(raw)) {
      throw new Error(`Import failed: card ${index + 1} is not an object.`)
    }
    const id = readString(raw.id, `card ${index + 1} id`)
    const title = readString(raw.title, `card ${index + 1} title`)
    const columnId = readString(raw.columnId, `card "${title}" column id`)

    if (cardIds.has(id)) {
      throw new Error(`Import failed: duplicate card id "${id}".`)
    }
    cardIds.add(id)
    if (!columnIds.has(columnId)) {
      throw new Error(
        `Import failed: card "${title}" points to a column that does not exist.`,
      )
    }

    const description =
      typeof raw.description === 'string' ? raw.description.trim() : ''
    const assignee = typeof raw.assignee === 'string' ? raw.assignee.trim() : ''
    const position =
      typeof raw.position === 'number' && Number.isFinite(raw.position)
        ? raw.position
        : index

    return {
      id,
      columnId,
      title,
      description,
      priority: readPriority(raw.priority),
      dueDate: readDueDate(raw.dueDate),
      labels: readLabels(raw.labels),
      assignee,
      position,
    }
  })

  // Re-index positions per column so ordering is contiguous and predictable.
  const normalizedCards = cards.map((card) => ({ ...card }))
  for (const column of normalizedColumns) {
    const columnCards = normalizedCards
      .filter((card) => card.columnId === column.id)
      .sort((first, second) => first.position - second.position)
    columnCards.forEach((card, index) => {
      card.position = index
    })
  }

  const boardLabels = normalizeLabels([
    ...readLabels(root.labels),
    ...normalizedCards.flatMap((card) => card.labels),
  ])

  return {
    board: { columns: normalizedColumns, cards: normalizedCards, labels: boardLabels },
    columnCount: normalizedColumns.length,
    cardCount: normalizedCards.length,
  }
}

export function exportBoardToFile(board: Board): string {
  const payload: ExportPayload = {
    app: 'flowboard',
    version: 1,
    exportedAt: new Date().toISOString(),
    board,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const filename = `flowboard-${todayISO()}.json`
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)

  return filename
}
