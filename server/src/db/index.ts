import Database from 'better-sqlite3';
import fs from 'node:fs';
import { config } from '../config.js';
import { SCHEMA } from './schema.js';

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(config.audioDir, { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(SCHEMA);

/** Additive migrations for DBs created before a column existed (CREATE TABLE IF NOT EXISTS won't alter them). */
function ensureColumn(table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

ensureColumn('versions', 'lyric_timestamps', 'lyric_timestamps TEXT');
ensureColumn('songs', 'comment', "comment TEXT NOT NULL DEFAULT ''");
