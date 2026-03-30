import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'kissa.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    stream_id   TEXT    NOT NULL,
    started_at  INTEGER NOT NULL,  -- unix ms
    ended_at    INTEGER,           -- unix ms, null if ongoing
    liked       INTEGER DEFAULT 0, -- 1 if ❤️
    skipped     INTEGER DEFAULT 0  -- 1 if ⏭️
  );

  CREATE TABLE IF NOT EXISTS stream_weights (
    stream_id   TEXT PRIMARY KEY,
    weight      REAL NOT NULL DEFAULT 1.0
  );
`);

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
    const result = db
      .prepare('INSERT INTO sessions (stream_id, started_at) VALUES (?, ?)')
      .run(streamId, Date.now());
    return result.lastInsertRowid as number;
  },

  end(sessionId: number): void {
    db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(
      Date.now(),
      sessionId,
    );
  },

  like(sessionId: number): void {
    db.prepare('UPDATE sessions SET liked = 1 WHERE id = ?').run(sessionId);
  },

  skip(sessionId: number): void {
    db.prepare('UPDATE sessions SET skipped = 1 WHERE id = ?').run(sessionId);
  },

  /** Return listening duration in ms. */
  duration(sessionId: number): number {
    const row = db
      .prepare('SELECT started_at, ended_at FROM sessions WHERE id = ?')
      .get(sessionId) as { started_at: number; ended_at: number | null } | undefined;
    if (!row) return 0;
    return (row.ended_at ?? Date.now()) - row.started_at;
  },
};

/** Adjust weights based on accumulated feedback. */
export function recalcWeights(streamId: string): number {
  const rows = db
    .prepare(
      `SELECT
        COUNT(*) as plays,
        SUM(liked) as likes,
        SUM(skipped) as skips,
        AVG(CASE WHEN ended_at IS NOT NULL THEN ended_at - started_at ELSE NULL END) as avg_ms
       FROM sessions WHERE stream_id = ?`,
    )
    .get(streamId) as {
    plays: number;
    likes: number;
    skips: number;
    avg_ms: number | null;
  };

  let weight = 1.0;
  if (rows.plays > 0) {
    // Likes bump weight, skips reduce it
    weight += (rows.likes / rows.plays) * 0.5;
    weight -= (rows.skips / rows.plays) * 0.4;
    // Long listen time bumps weight (baseline: 10 min)
    if (rows.avg_ms) {
      const ratio = rows.avg_ms / (10 * 60 * 1000);
      weight += Math.min(ratio * 0.3, 0.3);
    }
  }

  weight = Math.max(0.1, Math.min(weight, 3.0));

  db.prepare(
    'INSERT OR REPLACE INTO stream_weights (stream_id, weight) VALUES (?, ?)',
  ).run(streamId, weight);

  return weight;
}

export function getWeight(streamId: string): number {
  const row = db
    .prepare('SELECT weight FROM stream_weights WHERE stream_id = ?')
    .get(streamId) as { weight: number } | undefined;
  return row?.weight ?? 1.0;
}
