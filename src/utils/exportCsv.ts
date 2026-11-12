import type { Board, Card } from '../types'
import { todayISO } from './dates'
import { downloadTextFile } from './download'

export const CSV_HEADERS = [
  'Column',
  'Title',
  'Description',
  'Priority',
  'Due date',
  'Labels',
  'Assignee',
] as const

/**
 * Characters that make a spreadsheet evaluate a cell as a formula. Card
 * titles and descriptions are user-supplied, so they are neutralized with a
 * leading apostrophe (spreadsheets read that as "treat as text").
 */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r']

/** Escapes a single CSV field (RFC 4180) and neutralizes formula injection. */
export function escapeCsvValue(value: string): string {
  if (value === '') return ''

  let safe = value
  if (FORMULA_PREFIXES.some((prefix) => safe.startsWith(prefix))) {
    safe = `'${safe}`
  }

  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

/**
 * Builds an RFC 4180 CSV report of the board: one row per card, ordered by
 * column order and then by card position. Pure function — no DOM access.
 */
export function boardToCsv(board: Board): string {
  const columns = [...board.columns].sort((first, second) => first.order - second.order)

  const cardsByColumn = new Map<string, Card[]>()
  for (const column of columns) {
    cardsByColumn.set(column.id, [])
  }
  for (const card of board.cards) {
    cardsByColumn.get(card.columnId)?.push(card)
  }

  const rows: string[] = [CSV_HEADERS.join(',')]

  for (const column of columns) {
    const cards = (cardsByColumn.get(column.id) ?? []).sort(
      (first, second) => first.position - second.position,
    )
    for (const card of cards) {
      rows.push(
        [
          column.title,
          card.title,
          card.description,
          card.priority,
          card.dueDate ?? '',
          card.labels.join('; '),
          card.assignee,
        ]
          .map(escapeCsvValue)
          .join(','),
      )
    }
  }

  return rows.join('\r\n')
}

/**
 * Downloads the board as a CSV report. A UTF-8 BOM is prepended so Excel
 * detects the encoding and renders accented characters correctly.
 */
export function exportBoardToCsvFile(board: Board): string {
  const filename = `flowboard-${todayISO()}.csv`
  downloadTextFile(filename, `\uFEFF${boardToCsv(board)}`, 'text/csv;charset=utf-8;')
  return filename
}
