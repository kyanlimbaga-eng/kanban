import type { Request, Response, NextFunction } from 'express'
import crypto from 'node:crypto'
import { db, recordAuditLog, type UserRow } from './db'

export interface AuthenticatedUser {
  id: string
  username: string
  displayName: string
  role: 'admin' | 'viewer'
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
      clientIp?: string
    }
  }
}

// In-memory rate limiter for failed login attempts
interface FailedAttempt {
  count: number
  lockedUntil: number
}
const failedAttempts = new Map<string, FailedAttempt>()

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    const list = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]
    return list.trim()
  }
  return req.socket.remoteAddress || req.ip || '127.0.0.1'
}

export function isLanIp(ip: string): boolean {
  // Normalize IPv6 mapped IPv4 e.g. ::ffff:192.168.1.1
  const cleanIp = ip.replace(/^::ffff:/, '')
  if (
    cleanIp === '127.0.0.1' ||
    cleanIp === '::1' ||
    cleanIp === 'localhost' ||
    cleanIp.startsWith('10.') ||
    cleanIp.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp)
  ) {
    return true
  }
  return false
}

export function lanFilter(req: Request, res: Response, next: NextFunction): void {
  const lanCheckEnabled = process.env.LAN_RESTRICT_ENABLED !== 'false'
  const ip = getClientIp(req)
  req.clientIp = ip

  if (lanCheckEnabled && !isLanIp(ip)) {
    res.status(403).json({ error: 'Access restricted to local area network.' })
    return
  }
  next()
}

export function checkLoginRateLimit(ip: string): { allowed: boolean; remainingMs?: number } {
  const record = failedAttempts.get(ip)
  if (!record) return { allowed: true }

  const now = Date.now()
  if (record.lockedUntil > now) {
    return { allowed: false, remainingMs: record.lockedUntil - now }
  }

  if (record.lockedUntil > 0 && record.lockedUntil <= now) {
    failedAttempts.delete(ip)
    return { allowed: true }
  }

  return { allowed: true }
}

export function recordFailedLogin(ip: string): void {
  const now = Date.now()
  const record = failedAttempts.get(ip) || { count: 0, lockedUntil: 0 }
  record.count += 1
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS
  }
  failedAttempts.set(ip, record)
}

export function resetLoginAttempts(ip: string): void {
  failedAttempts.delete(ip)
}

export function createSession(userId: string, req: Request): string {
  const sessionId = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
  const ip = getClientIp(req)
  const userAgent = req.headers['user-agent'] || null

  db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at, ip_address, user_agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, userId, expiresAt, ip, userAgent, new Date().toISOString())

  return sessionId
}

export function getSessionUser(sessionId: string): AuthenticatedUser | null {
  if (!sessionId) return null

  const row = db.prepare(`
    SELECT s.id as session_id, s.expires_at, u.id, u.username, u.display_name, u.role
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `).get(sessionId) as ({ session_id: string; expires_at: string } & UserRow) | undefined

  if (!row) return null

  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
    return null
  }

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
  }
}

export function deleteSession(sessionId: string): void {
  if (!sessionId) return
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  req.clientIp = getClientIp(req)

  let token = req.cookies?.flowboard_session
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7)
  }

  if (token) {
    const user = getSessionUser(token)
    if (user) {
      req.user = user
    }
  }

  next()
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' })
    return
  }
  next()
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' })
    return
  }
  if (req.user.role !== 'admin') {
    recordAuditLog(req.user.id, req.user.username, 'UNAUTHORIZED_ADMIN_ATTEMPT', 'route', req.originalUrl, undefined, req.clientIp)
    res.status(403).json({ error: 'Forbidden. Administrator privileges required.' })
    return
  }
  next()
}
