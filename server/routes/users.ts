import { Router, type Request, type Response } from 'express'
import crypto from 'node:crypto'
import { requireAdmin } from '../auth'
import {
  db,
  hashPassword,
  createSalt,
  labelExists,
  normalizeLabelNames,
  getUserLabels,
  recordAuditLog,
  type UserRow,
} from '../db'

export const usersRouter = Router()

/** Returns the label names that are not present in the label catalog. */
function findUnknownLabels(labels: string[]): string[] {
  return labels.filter((name) => !labelExists(name))
}

// List users (including their assigned labels)
usersRouter.get('/', requireAdmin, (req: Request, res: Response): void => {
  const rows = db.prepare(`
    SELECT
      id,
      username,
      role,
      display_name as displayName,
      must_change_password as mustChangePassword,
      created_at as createdAt
    FROM users
    ORDER BY created_at ASC
  `).all() as Array<{
    id: string
    username: string
    role: 'admin' | 'viewer'
    displayName: string
    mustChangePassword: number
    createdAt: string
  }>

  const users = rows.map((row) => ({
    id: row.id,
    username: row.username,
    role: row.role,
    displayName: row.displayName,
    createdAt: row.createdAt,
    labels: getUserLabels(row.id),
    mustChangePassword: row.mustChangePassword === 1,
  }))

  res.json({ users })
})

// Create user
usersRouter.post('/', requireAdmin, (req: Request, res: Response): void => {
  const { username, password, displayName, role, labels, mustChangePassword } = req.body || {}
  const cleanUsername = (username || '').trim().toLowerCase()
  const cleanDisplayName = (displayName || '').trim() || cleanUsername
  const cleanRole = role === 'admin' ? 'admin' : 'viewer'
  const cleanLabels = normalizeLabelNames(labels)
  // New accounts must replace the administrator-issued password at first
  // sign-in unless the admin explicitly opts out.
  const requirePasswordChange = mustChangePassword === false ? 0 : 1

  if (!cleanUsername || cleanUsername.length < 3) {
    res.status(400).json({ error: 'Username must be at least 3 characters long.' })
    return
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long.' })
    return
  }
  const unknownLabels = findUnknownLabels(cleanLabels)
  if (unknownLabels.length > 0) {
    res.status(400).json({ error: `Unknown label(s): ${unknownLabels.join(', ')}.` })
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

  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password_hash, salt, role, display_name, must_change_password, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertAssignment = db.prepare('INSERT OR IGNORE INTO user_labels (user_id, label_name, created_at) VALUES (?, ?, ?)')

  db.exec('BEGIN TRANSACTION;')
  try {
    insertUser.run(id, cleanUsername, passwordHash, salt, cleanRole, cleanDisplayName, requirePasswordChange, now)
    cleanLabels.forEach((label) => insertAssignment.run(id, label, now))
    db.exec('COMMIT;')
  } catch (err) {
    db.exec('ROLLBACK;')
    res.status(500).json({ error: 'Failed to create user: ' + String(err) })
    return
  }

  recordAuditLog(
    req.user!.id,
    req.user!.username,
    'CREATE_USER',
    'user',
    id,
    `${cleanUsername} (${cleanRole})${cleanLabels.length > 0 ? ` labels: ${cleanLabels.join(', ')}` : ''}${
      requirePasswordChange ? ' — password change required at first login' : ''
    }`,
    req.clientIp,
  )

  res.status(201).json({
    id,
    username: cleanUsername,
    displayName: cleanDisplayName,
    role: cleanRole,
    labels: cleanLabels,
    mustChangePassword: requirePasswordChange === 1,
    createdAt: now,
  })
})

// Replace the labels assigned to an account (label-based task visibility)
usersRouter.put('/:id/labels', requireAdmin, (req: Request, res: Response): void => {
  const { id } = req.params
  const cleanLabels = normalizeLabelNames(req.body?.labels)

  const target = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!target) {
    res.status(404).json({ error: 'User not found.' })
    return
  }

  const unknownLabels = findUnknownLabels(cleanLabels)
  if (unknownLabels.length > 0) {
    res.status(400).json({ error: `Unknown label(s): ${unknownLabels.join(', ')}.` })
    return
  }

  const now = new Date().toISOString()
  const clearAssignments = db.prepare('DELETE FROM user_labels WHERE user_id = ?')
  const insertAssignment = db.prepare('INSERT OR IGNORE INTO user_labels (user_id, label_name, created_at) VALUES (?, ?, ?)')

  db.exec('BEGIN TRANSACTION;')
  try {
    clearAssignments.run(id)
    cleanLabels.forEach((label) => insertAssignment.run(id, label, now))
    db.exec('COMMIT;')
  } catch (err) {
    db.exec('ROLLBACK;')
    res.status(500).json({ error: 'Failed to update labels: ' + String(err) })
    return
  }

  recordAuditLog(
    req.user!.id,
    req.user!.username,
    'UPDATE_USER_LABELS',
    'user',
    id,
    `${target.username} -> ${cleanLabels.length > 0 ? cleanLabels.join(', ') : '(no labels)'}`,
    req.clientIp,
  )

  res.json({ success: true, id, labels: cleanLabels })
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
