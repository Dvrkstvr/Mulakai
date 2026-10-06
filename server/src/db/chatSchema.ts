/**
 * Chat tables (pipeline/architecture.md "Data (chat)", docs/decisions/0007). Additive only:
 * exec'd from db/index.ts after SCHEMA on every start, so an existing library gains them with no
 * rewrite; later columns go through ensureColumn. Lifecycle (D-102): trash keeps a thread,
 * permanently deleting the song cascades to its thread and messages; a deleted version leaves
 * its card with version_id NULL. Exactly one draft thread (song_id NULL), by the partial index.
 * C3 (D-127, docs/decisions/0008): `chat_references` hang off a thread; their files under
 * audioDir/references are removed by referenceStore.sweepFiles (orphans by id), not by a trigger.
 */
export const CHAT_SCHEMA = `
CREATE TABLE IF NOT EXISTS chat_threads (
  id         TEXT PRIMARY KEY,
  song_id    TEXT UNIQUE REFERENCES songs(id) ON DELETE CASCADE, -- NULL = the draft thread (no song yet)
  draft_json TEXT NOT NULL DEFAULT '{}',                         -- Draft, versioned by draft_v
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_threads_one_draft ON chat_threads((song_id IS NULL)) WHERE song_id IS NULL;

CREATE TABLE IF NOT EXISTS chat_messages (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,                                  -- order in the thread
  role        TEXT NOT NULL,                                     -- user | assistant
  kind        TEXT NOT NULL,                                     -- text | say | ask | recipe | edit | failed | song | version
  text        TEXT NOT NULL DEFAULT '',
  body_json   TEXT,                                              -- card snapshot / turn facts, versioned by chat_v
  proposal_id TEXT,                                              -- live only while proposalStore / planStore holds it
  job_id      TEXT,                                              -- the turn or commit job, for rehydration
  version_id  TEXT REFERENCES versions(id) ON DELETE SET NULL,   -- the version a card shows / a commit made
  client_key  TEXT,                                              -- a user message's idempotency key
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (thread_id, seq), UNIQUE (thread_id, client_key)
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id, seq);

CREATE TABLE IF NOT EXISTS chat_references (
  id             TEXT PRIMARY KEY,
  thread_id      TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  origin         TEXT NOT NULL,                                  -- upload | library
  name           TEXT NOT NULL,                                  -- the file's name or the library title
  source_song_id TEXT REFERENCES songs(id) ON DELETE SET NULL,   -- a library pick; the copy stays when that song goes
  file           TEXT NOT NULL,                                  -- 'references/<id>.<ext>' under audioDir, a copy
  bytes          INTEGER NOT NULL,
  sha256         TEXT NOT NULL,
  seconds        REAL,                                           -- probed length of the whole file
  own_json       TEXT,                                           -- library pick: the song's own data, own_v
  reading_json   TEXT,                                           -- the latest Reading, reading_v
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_references_thread ON chat_references(thread_id);
`;
