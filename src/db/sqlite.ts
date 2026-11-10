type SqliteDb = {
  exec: (sql: string | { sql: string; bind?: unknown[] }) => void
  selectObjects: (sql: string, bind?: unknown[]) => Array<Record<string, unknown>>
  close: () => void
}

const STORAGE_KEYS = ['flowboard.board', 'flowboard.ui'] as const

let databasePromise: Promise<SqliteDb> | null = null

async function initDatabase(): Promise<SqliteDb> {
  const { default: sqlite3InitModule } = await import('@sqlite.org/sqlite-wasm')
  const sqlite3 = await sqlite3InitModule()
  const db = new (sqlite3.oo1 as { JsStorageDb: new (mode: 'local' | 'session') => SqliteDb }).JsStorageDb('local')

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // Migrate the previous localStorage data once, without overwriting newer SQLite data.
  for (const key of STORAGE_KEYS) {
    const existing = db.selectObjects('SELECT value FROM app_state WHERE key = ?', [key])
    if (existing.length > 0) continue

    const raw = window.localStorage.getItem(key)
    if (!raw) continue

    try {
      JSON.parse(raw)
      db.exec({
        sql: 'INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)',
        bind: [key, raw, new Date().toISOString()],
      })
    } catch {
      // Ignore malformed legacy data and let the app seed fresh defaults.
    }
  }

  return db
}

async function getDatabase(): Promise<SqliteDb> {
  if (!databasePromise) {
    databasePromise = initDatabase().catch((error) => {
      databasePromise = null
      throw error
    })
  }
  return databasePromise
}

export async function sqliteGetItem(key: string): Promise<string | null> {
  try {
    const db = await getDatabase()
    const rows = db.selectObjects('SELECT value FROM app_state WHERE key = ?', [key])
    return rows.length > 0 ? String(rows[0].value) : null
  } catch (error) {
    console.warn('SQLite read failed; falling back to localStorage.', error)
    return window.localStorage.getItem(key)
  }
}

export async function sqliteSetItem(key: string, value: string): Promise<void> {
  try {
    const db = await getDatabase()
    db.exec({
      sql: `
        INSERT INTO app_state (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `,
      bind: [key, value, new Date().toISOString()],
    })
  } catch (error) {
    console.warn('SQLite write failed; falling back to localStorage.', error)
    window.localStorage.setItem(key, value)
  }
}

export async function sqliteRemoveItem(key: string): Promise<void> {
  try {
    const db = await getDatabase()
    db.exec({
      sql: 'DELETE FROM app_state WHERE key = ?',
      bind: [key],
    })
  } catch (error) {
    console.warn('SQLite delete failed; falling back to localStorage.', error)
    window.localStorage.removeItem(key)
  }
}
