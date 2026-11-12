process.env.NODE_ENV = 'test'
import assert from 'node:assert/strict'
import { boardToCsv, CSV_HEADERS } from '../src/utils/exportCsv'
import type { Board } from '../src/types'

/** Minimal RFC 4180 parser used to prove the generated CSV round-trips. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      continue
    }
    if (char === '\r' && text[index + 1] === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      index += 1
      continue
    }
    if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }
    field += char
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

const board: Board = {
  columns: [
    { id: 'col-review', title: 'Review', order: 1 },
    { id: 'col-todo', title: 'To Do', order: 0 },
  ],
  cards: [
    {
      id: 'card-1',
      columnId: 'col-review',
      title: 'Check "quotes", commas',
      description: 'line one\nline two',
      priority: 'high',
      dueDate: '2026-11-20',
      labels: ['AD DS', 'GPO'],
      assignee: 'Alex Morgan',
      position: 1,
    },
    {
      id: 'card-2',
      columnId: 'col-review',
      title: '=SUM(A1:A2)',
      description: '',
      priority: 'low',
      dueDate: null,
      labels: [],
      assignee: '',
      position: 0,
    },
    {
      id: 'card-3',
      columnId: 'col-todo',
      title: 'Plan, then build',
      description: '',
      priority: 'medium',
      dueDate: '2026-11-25',
      labels: ['PKI'],
      assignee: '',
      position: 0,
    },
  ],
  labels: ['AD DS', 'GPO', 'PKI'],
}

async function runTests() {
  console.log('--- Starting CSV Export Tests ---')

  const csv = boardToCsv(board)
  const rows = parseCsv(csv)

  // 1. Header row
  assert.deepEqual(rows[0], [...CSV_HEADERS])
  console.log('✓ Header row lists every exported field')

  // 2. Rows follow column order, then card position
  assert.equal(rows.length, 4, 'One header row plus one row per card')
  assert.deepEqual(rows[1], [
    'To Do',
    'Plan, then build',
    '',
    'medium',
    '2026-11-25',
    'PKI',
    '',
  ])
  console.log('✓ Rows are ordered by column order, then card position')

  // 3. Quoting survives a round-trip (commas, quotes, newlines)
  assert.deepEqual(rows[3], [
    'Review',
    'Check "quotes", commas',
    'line one\nline two',
    'high',
    '2026-11-20',
    'AD DS; GPO',
    'Alex Morgan',
  ])
  assert.ok(csv.includes('"Check ""quotes"", commas"'), 'Quotes must be doubled and wrapped')
  console.log('✓ Commas, quotes and newlines are escaped correctly')

  // 4. Spreadsheet formula injection is neutralized
  assert.equal(rows[2][1], "'=SUM(A1:A2)", 'Formula-looking titles must be prefixed')
  console.log('✓ Formula-like cell values are neutralized')

  // 5. Empty values become empty cells
  assert.equal(rows[2][4], '', 'A missing due date becomes an empty cell')
  assert.equal(rows[2][5], '', 'A card without labels joins to an empty string')
  console.log('✓ Missing values export as empty cells')

  // 6. CRLF line endings (RFC 4180 / Excel friendly)
  assert.ok(csv.includes('\r\n'), 'Rows must be separated by CRLF')
  console.log('✓ CSV uses CRLF line endings')

  console.log('\n--- ALL CSV EXPORT TESTS PASSED SUCCESSFULLY! ---')
}

runTests().catch((err) => {
  console.error('Test suite failed:', err)
  process.exit(1)
})
