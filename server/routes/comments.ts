import { Router, type Request, type Response } from 'express'
import crypto from 'node:crypto'
import { requireAuth } from '../auth'
import { db, recordAuditLog, type CommentRow } from '../db'
import { canSeeCard, parseCardLabels } from '../access'
import { broadcastWsEvent } from '../ws'

export const commentsRouter = Router()

// Returns the card's labels when the requesting account is allowed to see
// the card, or null when the card does not exist or is out of scope.
// Respondents get a 404 in both cases so hidden cards cannot be probed.
function getVisibleCardLabels(cardId: string, req: Request): string[] | null {
  const card = db.prepare('SELECT labels FROM cards WHERE id = ?').get(cardId) as { labels: string } | undefined
  if (!card) return null
  const labels = parseCardLabels(card.labels)
  if (!canSeeCard(req.user!, labels)) return null
  return labels
}

// Get comments for a card
commentsRouter.get('/:id/comments', requireAuth, (req: Request, res: Response): void => {
  const { id } = req.params
  if (!getVisibleCardLabels(id, req)) {
    res.status(404).json({ error: 'Card not found.' })
    return
  }

  const rows = db.prepare(`
    SELECT c.id, c.card_id, c.user_id, c.username, c.content, c.created_at, u.display_name
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.card_id = ?
    ORDER BY c.created_at ASC
  `).all(id) as Array<CommentRow & { display_name: string | null }>

  const comments = rows.map((r) => ({
    id: r.id,
    cardId: r.card_id,
    userId: r.user_id,
    username: r.username,
    displayName: r.display_name || r.username,
    content: r.content,
    createdAt: r.created_at,
  }))

  res.json({ comments })
})

// Post comment
commentsRouter.post('/:id/comments', requireAuth, (req: Request, res: Response): void => {
  const { id } = req.params
  const { content } = req.body || {}
  const cleanContent = (content || '').trim()

  if (!cleanContent) {
    res.status(400).json({ error: 'Comment content cannot be empty.' })
    return
  }

  const card = db.prepare('SELECT id, title, labels FROM cards WHERE id = ?').get(id) as { id: string; title: string; labels: string } | undefined
  if (!card) {
    res.status(404).json({ error: 'Card not found.' })
    return
  }

  const cardLabels = parseCardLabels(card.labels)
  if (!canSeeCard(req.user!, cardLabels)) {
    res.status(404).json({ error: 'Card not found.' })
    return
  }

  const commentId = crypto.randomUUID()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO comments (id, card_id, user_id, username, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(commentId, id, req.user!.id, req.user!.username, cleanContent, now)

  const newComment = {
    id: commentId,
    cardId: id,
    userId: req.user!.id,
    username: req.user!.username,
    displayName: req.user!.displayName,
    content: cleanContent,
    createdAt: now,
  }

  recordAuditLog(req.user!.id, req.user!.username, 'ADD_COMMENT', 'card', id, cleanContent.slice(0, 50), req.clientIp)
  broadcastWsEvent({
    type: 'COMMENT_ADDED',
    payload: newComment,
    senderId: req.user!.id,
    cardLabels,
  })

  res.status(201).json(newComment)
})

// Delete comment
commentsRouter.delete('/:id/comments/:commentId', requireAuth, (req: Request, res: Response): void => {
  const { id, commentId } = req.params
  const comment = db.prepare('SELECT * FROM comments WHERE id = ? AND card_id = ?').get(commentId, id) as CommentRow | undefined

  if (!comment) {
    res.status(404).json({ error: 'Comment not found.' })
    return
  }

  // The card must be within the requester's label scope as well
  const cardLabels = getVisibleCardLabels(id, req)
  if (!cardLabels) {
    res.status(404).json({ error: 'Comment not found.' })
    return
  }

  // Admin or comment author can delete
  if (req.user!.role !== 'admin' && comment.user_id !== req.user!.id) {
    res.status(403).json({ error: 'Forbidden. You can only delete your own comments.' })
    return
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(commentId)

  recordAuditLog(req.user!.id, req.user!.username, 'DELETE_COMMENT', 'comment', commentId, undefined, req.clientIp)
  broadcastWsEvent({
    type: 'COMMENT_DELETED',
    payload: { cardId: id, commentId },
    senderId: req.user!.id,
    cardLabels,
  })

  res.json({ success: true, commentId })
})
