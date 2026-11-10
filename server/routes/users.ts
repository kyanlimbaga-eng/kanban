import { Router, type Request, type Response } from 'express'
import crypto from 'node:crypto'
import { requireAdmin } from '../auth'
import {
  db,
  hashPassword,
  createSalt,
  recordAuditLog,
  type UserRow,
} from '../db'

export const usersRouter = Router()

// List users
usersRouter.get('/', requireAdmin, (req: Request, res: Response): void => {
  const users = db.prepare(`
    SELECT id, username, role, display_name as displayName, created_at as createdAt
    FROM users
    ORDER BY created_at ASC
  `).all()

  res.json({ users })
})

// Create user
usersRouter.post('/', requireAdmin, (req: Request, res: Response): void => {
  const { username, password, displayName, role } = req.body || {}
  const cleanUsername = (username || '').trim().toLowerCase()
  const cleanDisplayName = (displayName || '').trim() || cleanUsername
  const cleanRole = role === 'admin' ? 'admin' : 'viewer'

  if (!cleanUsername || cleanUsername.length < 3) {
    res.status(400).json({ error: 'Username must be at least 3 characters long.' })
    return
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long.' })
    return
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername)
  if (existing) {
    res.status(409).json({ error: 'Username already exists.' })
    return
  }

  const salt = createSalt()
  const passwordHash = hashPassword(password, salt)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO users (id, username, password_hash, salt, role, display_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, cleanUsername, passwordHash, salt, cleanRole, cleanDisplayName, now)

  recordAuditLog(req.user!.id, req.user!.username, 'CREATE_USER', 'user', id, `${cleanUsername} (${cleanRole})`, req.clientIp)

  res.status(201).json({
    id,
    username: cleanUsername,
    displayName: cleanDisplayName,
    role: cleanRole,
    createdAt: now,
  })
})

// Reset password for a user
usersRouter.put('/:id/password', requireAdmin, (req: Request, res: Response): void => {
  const { id } = req.params
  const { newPassword } = req.body || {}

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long.' })
    return
  }

  const target = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!target) {
    res.status(404).json({ error: 'User not found.' })
    return
  }

  const salt = createSalt()
  const hash = hashPassword(newPassword, salt)

  db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, id)
  // Invalidate any active sessions for this user
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id)

  recordAuditLog(req.user!.id, req.user!.username, 'RESET_USER_PASSWORD', 'user', id, target.username, req.clientIp)

  res.json({ success: true, message: `Password reset for user ${target.username}.` })
})

// Change user role
usersRouter.put('/:id/role', requireAdmin, (req: Request, res: Response): void => {
  const { id } = req.params
  const { role } = req.body || {}

  if (role !== 'admin' && role !== 'viewer') {
    res.status(400).json({ error: "Role must be 'admin' or 'viewer'." })
    return
  }

  if (id === req.user!.id && role !== 'admin') {
    res.status(400).json({ error: 'You cannot remove admin privileges from yourself.' })
    return
  }

  const target = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!target) {
    res.status(404).json({ error: 'User not found.' })
    return
  }

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id)
  recordAuditLog(req.user!.id, req.user!.username, 'CHANGE_USER_ROLE', 'user', id, `${target.username} -> ${role}`, req.clientIp)

  res.json({ success: true, id, role })
})

// Delete user
usersRouter.delete('/:id', requireAdmin, (req: Request, res: Response): void => {
  const { id } = req.params
  if (id === req.user!.id) {
    res.status(400).json({ error: 'You cannot delete your own account.' })
    return
  }

  const target = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!target) {
    res.status(404).json({ error: 'User not found.' })
    return
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id)
  recordAuditLog(req.user!.id, req.user!.username, 'DELETE_USER', 'user', id, target.username, req.clientIp)

  res.json({ success: true, id })
})
