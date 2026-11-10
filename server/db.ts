import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export interface UserRow {
  id: string
  username: string
  password_hash: string
  salt: string
  role: 'admin' | 'viewer'
  display_name: string
  created_at: string
}

export interface SessionRow {
  id: string
  user_id: string
  expires_at: string
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface ColumnRow {
  id: string
  title: string
  position: number
  created_at: string
  updated_at: string
}

export interface CardRow {
  id: string
  column_id: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  labels: string // JSON array
  assignee: string
  position: number
  version: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CommentRow {
  id: string
  card_id: string
  user_id: string
  username: string
  content: string
  created_at: string
}

export interface LabelRow {
  id: string
  name: string
  created_at: string
}

export interface AuditLogRow {
  id: string
  user_id: string | null
  username: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  details: string | null
  ip_address: string | null
  created_at: string
}

export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex')
}

export function createSalt(): string {
  return crypto.randomBytes(16).toString('hex')
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const hash = hashPassword(password, salt)
  const hashBuf = Buffer.from(hash, 'hex')
  const expectedBuf = Buffer.from(expectedHash, 'hex')
  if (hashBuf.length !== expectedBuf.length) return false
  return crypto.timingSafeEqual(hashBuf, expectedBuf)
}

const dbDir = process.env.DATA_DIR || path.join(process.cwd(), 'data')
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const dbPath = process.env.DB_PATH || path.join(dbDir, 'flowboard.db')
export const db = new DatabaseSync(dbPath)

// Initialize schema and pragmas
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'viewer')),
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS columns (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    column_id TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high')),
    due_date TEXT,
    labels TEXT NOT NULL DEFAULT '[]',
    assignee TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS labels (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL COLLATE NOCASE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    username TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_cards_column ON cards(column_id, position);
  CREATE INDEX IF NOT EXISTS idx_comments_card ON comments(card_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
`)

// Seed initial users and board if empty
function seedDatabase() {
  const usersCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count
  const now = new Date().toISOString()

  if (usersCount === 0) {
    const adminSalt = createSalt()
    const adminHash = hashPassword('4dmin@2026!', adminSalt)
    db.prepare(`
      INSERT INTO users (id, username, password_hash, salt, role, display_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('user-admin-default', 'admin', adminHash, adminSalt, 'admin', 'Administrator', now)

    const viewerSalt = createSalt()
    const viewerHash = hashPassword('viewer123', viewerSalt)
    db.prepare(`
      INSERT INTO users (id, username, password_hash, salt, role, display_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('user-viewer-default', 'viewer', viewerHash, viewerSalt, 'viewer', 'Team Viewer', now)
  }

  const columnsCount = (db.prepare('SELECT COUNT(*) as count FROM columns').get() as { count: number }).count
  if (columnsCount === 0) {
    const colTodo = 'col-todo'
    const colInProgress = 'col-in-progress'
    const colReview = 'col-review'
    const colDone = 'col-done'

    const insertCol = db.prepare(`
      INSERT INTO columns (id, title, position, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `)

    insertCol.run(colTodo, 'To Do', 0, now, now)
    insertCol.run(colInProgress, 'In Progress', 1, now, now)
    insertCol.run(colReview, 'Review', 2, now, now)
    insertCol.run(colDone, 'Done', 3, now, now)

    const insertCard = db.prepare(`
      INSERT INTO cards (id, column_id, title, description, priority, due_date, labels, assignee, position, version, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    insertCard.run(
      'card-seed-1',
      colTodo,
      'Polish the empty states',
      'Make every empty view feel intentional with helpful copy and a clear next step.',
      'medium',
      null,
      JSON.stringify(['Design', 'Polish']),
      'Alex Morgan',
      0,
      1,
      'admin',
      now,
      now,
    )

    insertCard.run(
      'card-seed-2',
      colTodo,
      'Fix card drag on touch devices',
      'Long-press to drag on mobile and confirm the scroll behavior feels natural.',
      'high',
      null,
      JSON.stringify(['Bug']),
      'Priya Shah',
      1,
      1,
      'admin',
      now,
      now,
    )

    insertCard.run(
      'card-seed-3',
      colInProgress,
      'Plan the Q4 roadmap',
      'Collect team input, size the bets, and share a first draft for review.',
      'medium',
      null,
      JSON.stringify(['Planning']),
      'Jordan Lee',
      0,
      1,
      'admin',
      now,
      now,
    )

    insertCard.run(
      'card-seed-4',
      colDone,
      'Set up the design tokens',
      'Agree on colors, spacing, and typography before building the first screens.',
      'low',
      null,
      JSON.stringify(['Design']),
      'Alex Morgan',
      0,
      1,
      'admin',
      now,
      now,
    )

    const insertLabel = db.prepare(`
      INSERT OR IGNORE INTO labels (id, name, created_at) VALUES (?, ?, ?)
    `)
    insertLabel.run('lbl-1', 'Design', now)
    insertLabel.run('lbl-2', 'Polish', now)
    insertLabel.run('lbl-3', 'Bug', now)
    insertLabel.run('lbl-4', 'Planning', now)
  }
}

seedDatabase()

export function recordAuditLog(
  userId: string | null,
  username: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: string,
  ipAddress?: string,
) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, username, action, entity_type, entity_id, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      userId || null,
      username || null,
      action,
      entityType || null,
      entityId || null,
      details || null,
      ipAddress || null,
      new Date().toISOString(),
    )
  } catch (err) {
    console.error('Failed to write audit log:', err)
  }
}
