import Database from 'better-sqlite3';
import fs from 'node:fs';
import { config } from '../config.js';
import { SCHEMA } from './schema.js';
import { CHAT_SCHEMA } from './chatSchema.js';
import { backfillGenTask } from './backfillGenTask.js';

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(config.audioDir, { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(SCHEMA);
db.exec(CHAT_SCHEMA); // after SCHEMA: chat tables reference songs and versions

/** Additive migrations for DBs created before a column existed (CREATE TABLE IF NOT EXISTS won't alter them). */
function ensureColumn(table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

ensureColumn('versions', 'lyric_timestamps', 'lyric_timestamps TEXT');
ensureColumn('versions', 'word_timings', 'word_timings TEXT');
// C1 (F-052): the version's analysis (`analysis_v`, chat/analysisTypes.ts); null = not analyzed.
ensureColumn('versions', 'analysis_json', 'analysis_json TEXT');
ensureColumn('songs', 'comment', "comment TEXT NOT NULL DEFAULT ''");
ensureColumn('songs', 'genre', "genre TEXT NOT NULL DEFAULT ''");
ensureColumn('songs', 'album', "album TEXT NOT NULL DEFAULT ''");
ensureColumn('songs', 'cover_art_file', 'cover_art_file TEXT');
ensureColumn('songs', 'folder_id', 'folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL');
ensureColumn('songs', 'reference_audio_label', 'reference_audio_label TEXT');
ensureColumn('songs', 'reference_audio_influence', 'reference_audio_influence REAL');
ensureColumn('songs', 'reference_style_influence', 'reference_style_influence REAL');
ensureColumn('songs', 'gen_task', 'gen_task TEXT');
// No backfill: every song made before extra engines existed is ACE-Step's, which is null.
ensureColumn('songs', 'engine', 'engine TEXT');
db.exec(`CREATE INDEX IF NOT EXISTS idx_songs_folder ON songs(folder_id)`);
backfillGenTask(db);
