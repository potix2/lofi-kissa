import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'kissa.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let db: Database;

/** Must be called once before using any db functions. */
export async function initDb(): Promise<void> {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_FILE)
    ? new SQL.Database(fs.readFileSync(DB_FILE))
    : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      stream_id   TEXT    NOT NULL,
      started_at  INTEGER NOT NULL,
      ended_at    INTEGER,
      liked       INTEGER DEFAULT 0,
      skipped     INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS stream_weights (
      stream_id   TEXT PRIMARY KEY,
      weight      REAL NOT NULL DEFAULT 1.0
    );
  `);

  save();
}

function save(): void {
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

function getOne<T>(sql: string, params: (string | number)[]): T | undefined {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? (stmt.getAsObject() as unknown as T) : undefined;
  stmt.free();
  return row;
}

export interface Session {
  id: number;
  streamId: string;
  startedAt: number;
  endedAt?: number;
  liked: boolean;
  skipped: boolean;
}

export const sessionDb = {
  start(streamId: string): number {
    db.run('INSERT INTO sessions (stream_id, started_at) VALUES (?, ?)', [streamId, Date.now()]);
    const row = getOne<{ 'last_insert_rowid()': number }>('SELECT last_insert_rowid()', []);
    save();
    return row?.['last_insert_rowid()'] ?? 0;
  },

  end(sessionId: number): void {
    db.run('UPDATE sessions SET ended_at = ? WHERE id = ?', [Date.now(), sessionId]);
    save();
  },

  like(sessionId: number): void {
    db.run('UPDATE sessions SET liked = 1 WHERE id = ?', [sessionId]);
    save();
  },

  skip(sessionId: number): void {
    db.run('UPDATE sessions SET skipped = 1 WHERE id = ?', [sessionId]);
    save();
  },

  duration(sessionId: number): number {
    const row = getOne<{ started_at: number; ended_at: number | null }>(
      'SELECT started_at, ended_at FROM sessions WHERE id = ?',
      [sessionId],
    );
    if (!row) return 0;
    return (row.ended_at ?? Date.now()) - row.started_at;
  },
};

export function recalcWeights(streamId: string): number {
  const row = getOne<{
    plays: number;
    likes: number;
    skips: number;
    avg_ms: number | null;
  }>(
    `SELECT
      COUNT(*) as plays,
      SUM(liked) as likes,
      SUM(skipped) as skips,
      AVG(CASE WHEN ended_at IS NOT NULL THEN ended_at - started_at ELSE NULL END) as avg_ms
     FROM sessions WHERE stream_id = ?`,
    [streamId],
  );

  let weight = 1.0;
  if (row && row.plays > 0) {
    weight += (row.likes / row.plays) * 0.5;
    weight -= (row.skips / row.plays) * 0.4;
    if (row.avg_ms) {
      const ratio = row.avg_ms / (10 * 60 * 1000);
      weight += Math.min(ratio * 0.3, 0.3);
    }
  }

  weight = Math.max(0.1, Math.min(weight, 3.0));
  db.run('INSERT OR REPLACE INTO stream_weights (stream_id, weight) VALUES (?, ?)', [streamId, weight]);
  save();
  return weight;
}

export function getWeight(streamId: string): number {
  const row = getOne<{ weight: number }>(
    'SELECT weight FROM stream_weights WHERE stream_id = ?',
    [streamId],
  );
  return row?.weight ?? 1.0;
}
