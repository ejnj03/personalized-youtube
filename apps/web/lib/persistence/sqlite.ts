import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import type { ChatTurn, Mode, PersistenceAdapter, Patch } from '@showcase/sdk/core';

/**
 * Server-side persistence backed by a local SQLite file.
 *
 * Why this and not cookies/localStorage: `createNextHandler` calls
 * persistence.read/write/recordTurn on the SERVER (chat-handler.ts:229/408/418),
 * and `getRenderedPage` reads during SSR. A browser-only adapter can satisfy
 * neither, and cookies additionally cap at ~4 KB and can't be written mid-stream
 * once response headers are flushed.
 *
 * Lives in apps/web rather than the SDK because better-sqlite3 is a native
 * module — the SDK stays installable without a compile step.
 *
 * Single-machine and non-serverless by design (ephemeral FS on Vercel). For a
 * hosted deploy, use supabasePersistence instead.
 */

const DEFAULT_FILE = join(process.cwd(), '.showcase', 'showcase.db');

let db: Database.Database | null = null;

function open(file: string): Database.Database {
  if (db) return db;

  mkdirSync(dirname(file), { recursive: true });
  db = new Database(file);

  // WAL so a read during SSR doesn't block a concurrent write from a chat turn.
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS patches (
      visitor_id TEXT NOT NULL,
      slug       TEXT NOT NULL,
      mode_id    TEXT NOT NULL,
      seq        INTEGER NOT NULL,
      patch      TEXT NOT NULL,
      PRIMARY KEY (visitor_id, slug, mode_id, seq)
    );

    CREATE TABLE IF NOT EXISTS turns (
      visitor_id TEXT NOT NULL,
      slug       TEXT NOT NULL,
      mode_id    TEXT NOT NULL,
      seq        INTEGER NOT NULL,
      turn       TEXT NOT NULL,
      PRIMARY KEY (visitor_id, slug, mode_id, seq)
    );

    CREATE TABLE IF NOT EXISTS modes (
      id         TEXT PRIMARY KEY,
      visitor_id TEXT NOT NULL,
      slug       TEXT NOT NULL,
      title      TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_modes_visitor ON modes(visitor_id, slug, created_at);
  `);

  return db;
}

export function sqlitePersistence(file: string = DEFAULT_FILE): PersistenceAdapter {
  const conn = open(file);

  const nextSeq = conn.prepare(
    `SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM patches
      WHERE visitor_id = ? AND slug = ? AND mode_id = ?`
  );
  const nextTurnSeq = conn.prepare(
    `SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM turns
      WHERE visitor_id = ? AND slug = ? AND mode_id = ?`
  );

  const selPatches = conn.prepare(
    `SELECT patch FROM patches
      WHERE visitor_id = ? AND slug = ? AND mode_id = ? ORDER BY seq`
  );
  const insPatch = conn.prepare(
    `INSERT INTO patches (visitor_id, slug, mode_id, seq, patch) VALUES (?, ?, ?, ?, ?)`
  );
  const delPatches = conn.prepare(
    `DELETE FROM patches WHERE visitor_id = ? AND slug = ? AND mode_id = ?`
  );

  const selTurns = conn.prepare(
    `SELECT turn FROM turns
      WHERE visitor_id = ? AND slug = ? AND mode_id = ? ORDER BY seq DESC LIMIT ?`
  );
  const insTurn = conn.prepare(
    `INSERT INTO turns (visitor_id, slug, mode_id, seq, turn) VALUES (?, ?, ?, ?, ?)`
  );
  const delTurns = conn.prepare(
    `DELETE FROM turns WHERE visitor_id = ? AND slug = ? AND mode_id = ?`
  );

  const selModes = conn.prepare(
    `SELECT id, title, created_at FROM modes
      WHERE visitor_id = ? AND slug = ? ORDER BY created_at`
  );
  const insMode = conn.prepare(
    `INSERT INTO modes (id, visitor_id, slug, title, created_at) VALUES (?, ?, ?, ?, ?)`
  );

  // One transaction so a multi-patch turn is all-or-nothing — a partial write
  // would leave the config in a state the agent never produced.
  const writeMany = conn.transaction(
    (visitorId: string, slug: string, modeId: string, patches: Patch[]) => {
      let seq = (nextSeq.get(visitorId, slug, modeId) as { n: number }).n;
      for (const p of patches) {
        insPatch.run(visitorId, slug, modeId, seq++, JSON.stringify(p));
      }
    }
  );

  let counter = 0;
  const nextId = () => `mode-${Date.now()}-${++counter}`;

  return {
    async read(visitorId, slug, modeId): Promise<Patch[]> {
      const rows = selPatches.all(visitorId, slug, modeId) as { patch: string }[];
      return rows.map((r) => JSON.parse(r.patch) as Patch);
    },

    async write(visitorId, slug, modeId, patches): Promise<void> {
      if (!patches.length) return;
      writeMany(visitorId, slug, modeId, patches);
    },

    async reset(visitorId, slug, modeId): Promise<void> {
      delPatches.run(visitorId, slug, modeId);
      delTurns.run(visitorId, slug, modeId);
    },

    async recordTurn(visitorId, slug, modeId, turn): Promise<void> {
      const seq = (nextTurnSeq.get(visitorId, slug, modeId) as { n: number }).n;
      insTurn.run(visitorId, slug, modeId, seq, JSON.stringify(turn));
    },

    async readTurns(visitorId, slug, modeId, limit = 30): Promise<ChatTurn[]> {
      const rows = selTurns.all(visitorId, slug, modeId, limit) as { turn: string }[];
      // Selected DESC to apply LIMIT to the most recent; restore chronological order.
      return rows.reverse().map((r) => JSON.parse(r.turn) as ChatTurn);
    },

    async listModes(visitorId, slug): Promise<Mode[]> {
      const rows = selModes.all(visitorId, slug) as {
        id: string;
        title: string;
        created_at: string;
      }[];
      return rows.map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at }));
    },

    async createMode(visitorId, slug, title): Promise<Mode> {
      const mode: Mode = { id: nextId(), title, createdAt: new Date().toISOString() };
      insMode.run(mode.id, visitorId, slug, mode.title, mode.createdAt);
      return mode;
    },
  };
}
