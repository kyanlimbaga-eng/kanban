import { Router, type Request, type Response } from 'express'
import {
  checkLoginRateLimit,
  createSession,
  deleteSession,
  recordFailedLogin,
  resetLoginAttempts,
  requireAuth,
} from '../auth'
import {
  db,
  hashPassword,
  createSalt,
  getUserLabels,
  verifyPassword,
  recordAuditLog,
  type UserRow,
} from '../db'

export const authRouter = Router()

authRouter.post('/login', (req: Request, res: Response): void => {
  const ip = req.clientIp || '127.0.0.1'
  const limit = checkLoginRateLimit(ip)
  if (!limit.allowed) {
    const minutesLeft = Math.ceil((limit.remainingMs || 0) / 60000)
    res.status(429).json({
      error: `Too many failed login attempts. Please wait ${minutesLeft} minute(s) before trying again.`,
    })
    return
  }

  const { username, password } = req.body || {}
  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    res.status(400).json({ error: 'Username and password are required.' })
    return
  }

  const cleanUsername = username.trim().toLowerCase()
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanUsername) as UserRow | undefined

  if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
    recordFailedLogin(ip)
    recordAuditLog(null, cleanUsername, 'LOGIN_FAILED', 'user', undefined, 'Invalid credentials', ip)
    res.status(401).json({ error: 'Invalid username or password.' })
    return
  }

  resetLoginAttempts(ip)
  const sessionId = createSession(user.id, req)

  // 7 days cookie
  res.cookie('flowboard_session', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && req.secure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  })

  recordAuditLog(user.id, user.username, 'LOGIN_SUCCESS', 'user', user.id, 'User signed in', ip)

  res.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      // Labels scope which cards this account may see (admins are unrestricted)
      labels: user.role === 'admin' ? [] : getUserLabels(user.id),
      // True while the account still uses an administrator-issued password
      mustChangePassword: user.must_change_password === 1,
    },
  })
})

authRouter.post('/logout', (req: Request, res: Response): void => {
  const token = req.cookies?.flowboard_session
  if (token) {
    deleteSession(token)
  }
  res.clearCookie('flowboard_session', { path: '/' })
  if (req.user) {
    recordAuditLog(req.user.id, req.user.username, 'LOGOUT', 'user', req.user.id, undefined, req.clientIp)
  }
  res.json({ success: true })
})

authRouter.get('/me', (req: Request, res: Response): void => {
  if (!req.user) {
    res.json({ user: null })
    return
  }
  res.json({ user: req.user })
})

authRouter.put('/change-password', requireAuth, (req: Request, res: Response): void => {
  const { currentPassword, newPassword } = req.body || {}
  if (!currentPassword || !newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters long.' })
    return
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as UserRow | undefined
  if (!user || !verifyPassword(currentPassword, user.salt, user.password_hash)) {
    res.status(400).json({ error: 'Current password does not match.' })
    return
  }

  const newSalt = createSalt()
  const newHash = hashPassword(newPassword, newSalt)

  db.prepare('UPDATE users SET password_hash = ?, salt = ?, must_change_password = 0 WHERE id = ?').run(newHash, newSalt, user.id)

  // The old password is dead now: drop every other session of this account
  // so the temporary password cannot be used from another device.
  const currentToken = req.cookies?.flowboard_session ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '')
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(user.id, currentToken || '')

  recordAuditLog(user.id, user.username, 'PASSWORD_CHANGED', 'user', user.id, undefined, req.clientIp)

  res.json({ success: true, message: 'Password updated successfully.' })
})
