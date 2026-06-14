/* =========================================================================
 * SQLite layer — schema, connection, and standards helpers.
 *
 * DB path:
 *   production (Electron) → process.env.DB_PATH  (set by desktop/main.ts)
 *   development           → ./data/dev.sqlite     (relative to backend cwd)
 *
 * No business logic lives here — routes call into @cf-wavescan/shared for
 * anything analytic. This file only persists and retrieves.
 * ========================================================================= */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { CFLogic } from './shared';

function resolveDbPath(): string {
  if (process.env.DB_PATH && process.env.DB_PATH.trim()) {
    return process.env.DB_PATH; // production: Electron points this at %APPDATA%
  }
  return path.join(process.cwd(), 'data', 'dev.sqlite'); // development
}

const DB_PATH = resolveDbPath();
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON'); // required for the readings → files CASCADE

db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    filename    TEXT    NOT NULL,
    month_key   TEXT    NOT NULL,
    plant       TEXT,
    model       TEXT,
    row_count   INTEGER NOT NULL DEFAULT 0,
    imported_at TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS readings (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id   INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    month_key TEXT    NOT NULL,
    plant     TEXT,
    model     TEXT,
    color     TEXT    NOT NULL,
    family    TEXT    NOT NULL,
    zone      TEXT    NOT NULL,
    orient    TEXT    NOT NULL CHECK (orient IN ('H','V')),
    cf        REAL    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_readings_month
    ON readings(month_key);
  CREATE INDEX IF NOT EXISTS idx_readings_filter
    ON readings(month_key, color, plant, model);

  CREATE TABLE IF NOT EXISTS standards (
    id      INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pending_imports (
    id         TEXT PRIMARY KEY,
    filename   TEXT NOT NULL,
    payload    TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

/** Return the stored standards object, or the shared defaults when none set. */
export function getStandards(): any {
  const row = db.prepare('SELECT payload FROM standards WHERE id = 1').get() as
    | { payload: string }
    | undefined;
  if (row && row.payload) {
    try {
      return JSON.parse(row.payload);
    } catch {
      /* fall through to defaults on a corrupt blob */
    }
  }
  return CFLogic.defaultStandards(); // { families: DEFAULT_STANDARDS, colors: {} }
}

/** Upsert the standards JSON blob (id is always 1). */
export function setStandards(payload: any): void {
  db.prepare(
    `INSERT INTO standards (id, payload) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`
  ).run(JSON.stringify(payload));
}

export { DB_PATH };
