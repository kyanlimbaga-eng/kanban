import { Router, type Request, type Response } from 'express'
import { requireAdmin } from '../auth'
import { db, type AuditLogRow } from '../db'

export const auditRouter = Router()

// Get recent audit logs
auditRouter.get('/', requireAdmin, (req: Request, res: Response): void => {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200)
  const logs = db.prepare(`
    SELECT id, user_id as userId, username, action, entity_type as entityType, entity_id as entityId, details, ip_address as ipAddress, created_at as createdAt
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as AuditLogRow[]

  res.json({ logs })
})
