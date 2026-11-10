import { Router, type Request, type Response } from 'express'
import crypto from 'node:crypto'
import { requireAuth, requireAdmin } from '../auth'
import { db, recordAuditLog, type ColumnRow, type CardRow, type LabelRow } from '../db'
import { broadcastWsEvent } from '../ws'

export const boardRouter = Router()

interface FormattedCard {
  id: string
  columnId: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  dueDate: string | null
  labels: string[]
  assignee: string
  position: number
  version: number
  createdBy?: string | null
  updatedAt: string
}

function formatCard(row: CardRow): FormattedCard {
  let labels: string[] = []
  try {
    labels = JSON.parse(row.labels || '[]')
  } catch {
    labels = []
  }

  return {
    id: row.id,
    columnId: row.column_id,
    title: row.title,
    description: row.description || '',
    priority: row.priority,
    dueDate: row.due_date,
    labels,
    assignee: row.assignee || '',
    position: row.position,
    version: row.version,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  }
}

// GET full board
boardRouter.get('/', requireAuth, (req: Request, res: Response): void => {
  const columns = (db.prepare('SELECT id, title, position as `order` FROM columns ORDER BY position ASC').all() as Array<{ id: string; title: string; order: number }>)
  const cardRows = db.prepare('SELECT * FROM cards ORDER BY column_id, position ASC').all() as CardRow[]
  const labelRows = db.prepare('SELECT name FROM labels ORDER BY name ASC').all() as LabelRow[]

  const cards = cardRows.map(formatCard)
  const labels = labelRows.map((l) => l.name)

  res.json({
    columns,
    cards,
    labels,
  })
})

// Add column
boardRouter.post('/columns', requireAdmin, (req: Request, res: Response): void => {
  const { title } = req.body || {}
  const cleanTitle = (title || '').trim()
  if (!cleanTitle) {
    res.status(400).json({ error: 'Column title is required.' })
    return
  }

  const maxPosRow = db.prepare('SELECT MAX(position) as maxPos FROM columns').get() as { maxPos: number | null }
  const position = (maxPosRow.maxPos !== null && maxPosRow.maxPos !== undefined) ? maxPosRow.maxPos + 1 : 0
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO columns (id, title, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, cleanTitle, position, now, now)

  const column = { id, title: cleanTitle, order: position }

  recordAuditLog(req.user!.id, req.user!.username, 'CREATE_COLUMN', 'column', id, cleanTitle, req.clientIp)
  broadcastWsEvent({ type: 'COLUMN_CREATED', payload: column, senderId: req.user!.id })

  res.status(201).json(column)
})

// Rename column
boardRouter.put('/columns/:id', requireAdmin, (req: Request, res: Response): void => {
  const { id } = req.params
  const { title } = req.body || {}
  const cleanTitle = (title || '').trim()
  if (!cleanTitle) {
    res.status(400).json({ error: 'Column title is required.' })
    return
  }

  const existing = db.prepare('SELECT * FROM columns WHERE id = ?').get(id) as ColumnRow | undefined
  if (!existing) {
    res.status(404).json({ error: 'Column not found.' })
    return
  }

  const now = new Date().toISOString()
  db.prepare('UPDATE columns SET title = ?, updated_at = ? WHERE id = ?').run(cleanTitle, now, id)

  recordAuditLog(req.user!.id, req.user!.username, 'RENAME_COLUMN', 'column', id, cleanTitle, req.clientIp)
  broadcastWsEvent({
    type: 'COLUMN_RENAMED',
    payload: { id, title: cleanTitle },
    senderId: req.user!.id,
  })

  res.json({ id, title: cleanTitle, order: existing.position })
})

// Delete column
boardRouter.delete('/columns/:id', requireAdmin, (req: Request, res: Response): void => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM columns WHERE id = ?').get(id) as ColumnRow | undefined
  if (!existing) {
    res.status(404).json({ error: 'Column not found.' })
    return
  }

  db.prepare('DELETE FROM columns WHERE id = ?').run(id)

  // Re-index column positions
  const cols = db.prepare('SELECT id FROM columns ORDER BY position ASC').all() as Array<{ id: string }>
  const updatePos = db.prepare('UPDATE columns SET position = ? WHERE id = ?')
  cols.forEach((col, idx) => {
    updatePos.run(idx, col.id)
  })

  recordAuditLog(req.user!.id, req.user!.username, 'DELETE_COLUMN', 'column', id, existing.title, req.clientIp)
  broadcastWsEvent({ type: 'COLUMN_DELETED', payload: { id }, senderId: req.user!.id })

  res.json({ success: true, id })
})

// Reorder columns
boardRouter.put('/columns/reorder', requireAdmin, (req: Request, res: Response): void => {
  const { columnIds } = req.body || {}
  if (!Array.isArray(columnIds)) {
    res.status(400).json({ error: 'columnIds array is required.' })
    return
  }

  const updatePos = db.prepare('UPDATE columns SET position = ? WHERE id = ?')
  columnIds.forEach((id: string, idx: number) => {
    updatePos.run(idx, id)
  })

  recordAuditLog(req.user!.id, req.user!.username, 'REORDER_COLUMNS', 'columns', undefined, undefined, req.clientIp)
  broadcastWsEvent({
    type: 'COLUMNS_REORDERED',
    payload: { columnIds },
    senderId: req.user!.id,
  })

  res.json({ success: true, columnIds })
})

// Add card
boardRouter.post('/cards', requireAdmin, (req: Request, res: Response): void => {
  const { columnId, title, description, priority, dueDate, labels, assignee } = req.body || {}
  const cleanTitle = (title || '').trim()
  if (!cleanTitle) {
    res.status(400).json({ error: 'Card title is required.' })
    return
  }

  const col = db.prepare('SELECT id FROM columns WHERE id = ?').get(columnId)
  if (!col) {
    res.status(400).json({ error: 'Valid columnId is required.' })
    return
  }

  const validPriorities = ['low', 'medium', 'high']
  const cleanPriority = validPriorities.includes(priority) ? priority : 'medium'
  const cleanDueDate = dueDate && typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null
  const cleanLabels = Array.isArray(labels) ? labels.filter((l) => typeof l === 'string') : []
  const cleanAssignee = typeof assignee === 'string' ? assignee.trim() : ''

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO cards (id, column_id, title, description, priority, due_date, labels, assignee, position, version, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM cards WHERE column_id = ?), 0), 1, ?, ?, ?)
  `).run(
    id,
    columnId,
    cleanTitle,
    description || '',
    cleanPriority,
    cleanDueDate,
    JSON.stringify(cleanLabels),
    cleanAssignee,
    columnId,
    req.user!.username,
    now,
    now,
  )

  // Ensure labels exist in labels table
  const insertLabel = db.prepare('INSERT OR IGNORE INTO labels (id, name, created_at) VALUES (?, ?, ?)')
  cleanLabels.forEach((lbl: string) => {
    insertLabel.run(crypto.randomUUID(), lbl, now)
  })

  const newCardRow = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow
  const formatted = formatCard(newCardRow)

  recordAuditLog(req.user!.id, req.user!.username, 'CREATE_CARD', 'card', id, cleanTitle, req.clientIp)
  broadcastWsEvent({ type: 'CARD_CREATED', payload: formatted, senderId: req.user!.id })

  res.status(201).json(formatted)
})

// Update card with version concurrency check
boardRouter.put('/cards/:id', requireAdmin, (req: Request, res: Response): void => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow | undefined
  if (!existing) {
    res.status(404).json({ error: 'Card not found.' })
    return
  }

  const { title, description, priority, dueDate, labels, assignee, version } = req.body || {}

  // Check version conflict if provided by client
  if (typeof version === 'number' && version !== existing.version) {
    res.status(409).json({
      error: 'Conflict: This card was modified by another user. Reloading latest card version.',
      currentCard: formatCard(existing),
    })
    return
  }

  const cleanTitle = title !== undefined ? String(title).trim() : existing.title
  if (!cleanTitle) {
    res.status(400).json({ error: 'Title cannot be empty.' })
    return
  }

  const validPriorities = ['low', 'medium', 'high']
  const cleanPriority = priority && validPriorities.includes(priority) ? priority : existing.priority
  const cleanDueDate = dueDate !== undefined ? (dueDate ? String(dueDate) : null) : existing.due_date
  const cleanDesc = description !== undefined ? String(description) : existing.description
  const cleanAssignee = assignee !== undefined ? String(assignee).trim() : existing.assignee

  let cleanLabels = existing.labels
  if (labels !== undefined) {
    cleanLabels = JSON.stringify(Array.isArray(labels) ? labels : [])
  }

  const nextVersion = existing.version + 1
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE cards
    SET title = ?, description = ?, priority = ?, due_date = ?, labels = ?, assignee = ?, version = ?, updated_at = ?
    WHERE id = ?
  `).run(cleanTitle, cleanDesc, cleanPriority, cleanDueDate, cleanLabels, cleanAssignee, nextVersion, now, id)

  const updatedRow = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow
  const formatted = formatCard(updatedRow)

  recordAuditLog(req.user!.id, req.user!.username, 'UPDATE_CARD', 'card', id, cleanTitle, req.clientIp)
  broadcastWsEvent({ type: 'CARD_UPDATED', payload: formatted, senderId: req.user!.id })

  res.json(formatted)
})

// Move card across columns or within a column
boardRouter.put('/cards/:id/move', requireAdmin, (req: Request, res: Response): void => {
  const { id } = req.params
  const { toColumnId, toIndex } = req.body || {}

  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow | undefined
  if (!card) {
    res.status(404).json({ error: 'Card not found.' })
    return
  }

  const targetCol = db.prepare('SELECT id FROM columns WHERE id = ?').get(toColumnId)
  if (!targetCol) {
    res.status(400).json({ error: 'Target column does not exist.' })
    return
  }

  const fromColumnId = card.column_id
  const targetIndex = Math.max(0, parseInt(toIndex, 10) || 0)
  const now = new Date().toISOString()

  // Pull cards in destination column excluding the moving card
  const destCards = db.prepare('SELECT id FROM cards WHERE column_id = ? AND id != ? ORDER BY position ASC').all(toColumnId, id) as Array<{ id: string }>
  const newOrder = destCards.map((c) => c.id)
  newOrder.splice(Math.min(targetIndex, newOrder.length), 0, id)

  // Update position of cards in target column
  const updateCardPos = db.prepare('UPDATE cards SET column_id = ?, position = ?, updated_at = ? WHERE id = ?')
  newOrder.forEach((cardId, index) => {
    updateCardPos.run(toColumnId, index, now, cardId)
  })

  // Normalize source column if different
  if (fromColumnId !== toColumnId) {
    const srcCards = db.prepare('SELECT id FROM cards WHERE column_id = ? ORDER BY position ASC').all(fromColumnId) as Array<{ id: string }>
    const updateSrcPos = db.prepare('UPDATE cards SET position = ? WHERE id = ?')
    srcCards.forEach((c, idx) => {
      updateSrcPos.run(idx, c.id)
    })
  }

  recordAuditLog(req.user!.id, req.user!.username, 'MOVE_CARD', 'card', id, `Moved to ${toColumnId} at pos ${targetIndex}`, req.clientIp)
  broadcastWsEvent({
    type: 'CARD_MOVED',
    payload: { cardId: id, fromColumnId, toColumnId, toIndex: targetIndex },
    senderId: req.user!.id,
  })

  res.json({ success: true, cardId: id, toColumnId, toIndex: targetIndex })
})

// Delete card
boardRouter.delete('/cards/:id', requireAdmin, (req: Request, res: Response): void => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow | undefined
  if (!existing) {
    res.status(404).json({ error: 'Card not found.' })
    return
  }

  // Delete dependent comments explicitly to ensure clean cascade across configurations
  db.prepare('DELETE FROM comments WHERE card_id = ?').run(id)
  db.prepare('DELETE FROM cards WHERE id = ?').run(id)

  // Normalize remaining cards in column
  const remaining = db.prepare('SELECT id FROM cards WHERE column_id = ? ORDER BY position ASC').all(existing.column_id) as Array<{ id: string }>
  const updatePos = db.prepare('UPDATE cards SET position = ? WHERE id = ?')
  remaining.forEach((c, idx) => {
    updatePos.run(idx, c.id)
  })

  recordAuditLog(req.user!.id, req.user!.username, 'DELETE_CARD', 'card', id, existing.title, req.clientIp)
  broadcastWsEvent({
    type: 'CARD_DELETED',
    payload: { id, columnId: existing.column_id },
    senderId: req.user!.id,
  })

  res.json({ success: true, id })
})

// Labels management
boardRouter.post('/labels', requireAdmin, (req: Request, res: Response): void => {
  const { name } = req.body || {}
  const cleanName = (name || '').trim()
  if (!cleanName) {
    res.status(400).json({ error: 'Label name is required.' })
    return
  }

  const now = new Date().toISOString()
  db.prepare('INSERT OR IGNORE INTO labels (id, name, created_at) VALUES (?, ?, ?)').run(crypto.randomUUID(), cleanName, now)

  recordAuditLog(req.user!.id, req.user!.username, 'CREATE_LABEL', 'label', undefined, cleanName, req.clientIp)
  broadcastWsEvent({ type: 'LABEL_CREATED', payload: { name: cleanName }, senderId: req.user!.id })

  res.status(201).json({ name: cleanName })
})

boardRouter.put('/labels/:name', requireAdmin, (req: Request, res: Response): void => {
  const oldName = decodeURIComponent(req.params.name).trim()
  const { newName } = req.body || {}
  const cleanNewName = (newName || '').trim()
  if (!cleanNewName) {
    res.status(400).json({ error: 'New label name is required.' })
    return
  }

  db.prepare('UPDATE labels SET name = ? WHERE name = ? COLLATE NOCASE').run(cleanNewName, oldName)

  // Update card labels
  const cards = db.prepare('SELECT id, labels FROM cards').all() as Array<{ id: string; labels: string }>
  const updateCardLabels = db.prepare('UPDATE cards SET labels = ? WHERE id = ?')

  cards.forEach((card) => {
    try {
      const labels: string[] = JSON.parse(card.labels || '[]')
      const updated = labels.map((l) => (l.toLowerCase() === oldName.toLowerCase() ? cleanNewName : l))
      // Deduplicate
      const unique = Array.from(new Set(updated))
      updateCardLabels.run(JSON.stringify(unique), card.id)
    } catch {
      // Ignore parse failure
    }
  })

  recordAuditLog(req.user!.id, req.user!.username, 'RENAME_LABEL', 'label', undefined, `${oldName} -> ${cleanNewName}`, req.clientIp)
  broadcastWsEvent({
    type: 'LABEL_RENAMED',
    payload: { oldName, newName: cleanNewName },
    senderId: req.user!.id,
  })

  res.json({ success: true, oldName, newName: cleanNewName })
})

boardRouter.delete('/labels/:name', requireAdmin, (req: Request, res: Response): void => {
  const name = decodeURIComponent(req.params.name).trim()
  db.prepare('DELETE FROM labels WHERE name = ? COLLATE NOCASE').run(name)

  // Remove from card labels
  const cards = db.prepare('SELECT id, labels FROM cards').all() as Array<{ id: string; labels: string }>
  const updateCardLabels = db.prepare('UPDATE cards SET labels = ? WHERE id = ?')

  cards.forEach((card) => {
    try {
      const labels: string[] = JSON.parse(card.labels || '[]')
      const filtered = labels.filter((l) => l.toLowerCase() !== name.toLowerCase())
      updateCardLabels.run(JSON.stringify(filtered), card.id)
    } catch {
      // Ignore
    }
  })

  recordAuditLog(req.user!.id, req.user!.username, 'DELETE_LABEL', 'label', undefined, name, req.clientIp)
  broadcastWsEvent({ type: 'LABEL_DELETED', payload: { name }, senderId: req.user!.id })

  res.json({ success: true, name })
})

// Import full board
boardRouter.post('/import', requireAdmin, (req: Request, res: Response): void => {
  const { columns, cards, labels } = req.body || {}
  if (!Array.isArray(columns) || !Array.isArray(cards)) {
    res.status(400).json({ error: 'Invalid board JSON structure.' })
    return
  }

  const now = new Date().toISOString()

  // Replace data in single transaction
  db.exec('BEGIN TRANSACTION;')
  try {
    db.exec('DELETE FROM comments;')
    db.exec('DELETE FROM cards;')
    db.exec('DELETE FROM columns;')
    db.exec('DELETE FROM labels;')

    const insertCol = db.prepare('INSERT INTO columns (id, title, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    columns.forEach((col: { id: string; title: string; order?: number }, idx: number) => {
      insertCol.run(col.id, col.title, col.order ?? idx, now, now)
    })

    const insertCard = db.prepare(`
      INSERT INTO cards (id, column_id, title, description, priority, due_date, labels, assignee, position, version, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `)

    cards.forEach((card: { id: string; columnId: string; title: string; description?: string; priority?: string; dueDate?: string | null; labels?: string[]; assignee?: string; position?: number }, idx: number) => {
      insertCard.run(
        card.id,
        card.columnId,
        card.title,
        card.description || '',
        card.priority || 'medium',
        card.dueDate || null,
        JSON.stringify(card.labels || []),
        card.assignee || '',
        card.position ?? idx,
        req.user!.username,
        now,
        now,
      )
    })

    const insertLabel = db.prepare('INSERT OR IGNORE INTO labels (id, name, created_at) VALUES (?, ?, ?)')
    if (Array.isArray(labels)) {
      labels.forEach((lbl: string) => {
        insertLabel.run(crypto.randomUUID(), lbl, now)
      })
    }

    db.exec('COMMIT;')
  } catch (err) {
    db.exec('ROLLBACK;')
    res.status(500).json({ error: 'Failed to import board: ' + String(err) })
    return
  }

  recordAuditLog(req.user!.id, req.user!.username, 'IMPORT_BOARD', 'board', undefined, `${columns.length} columns, ${cards.length} cards`, req.clientIp)
  broadcastWsEvent({ type: 'BOARD_REPLACED', payload: null, senderId: req.user!.id })

  res.json({ success: true, message: 'Board imported successfully.' })
})
