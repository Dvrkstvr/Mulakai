/** SQLite schema: songs -> layers -> versions. No users/social tables. */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS songs (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  caption        TEXT NOT NULL DEFAULT '',
  lyrics         TEXT NOT NULL DEFAULT '',
  bpm            INTEGER,
  key_scale      TEXT NOT NULL DEFAULT '',
  time_signature TEXT NOT NULL DEFAULT '',
  duration       REAL,
  favorite       INTEGER NOT NULL DEFAULT 0,
  trashed_at     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS layers (
  id           TEXT PRIMARY KEY,
  song_id      TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'base', -- base | vocals | drums | bass | guitar | ...
  position     INTEGER NOT NULL DEFAULT 0,
  region_start REAL NOT NULL DEFAULT 0,
  region_end   REAL,                          -- null = full length
  volume       REAL NOT NULL DEFAULT 1,
  muted        INTEGER NOT NULL DEFAULT 0,
  solo         INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS versions (
  id          TEXT PRIMARY KEY,
  layer_id    TEXT NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
  audio_file  TEXT NOT NULL,                  -- filename inside audioDir
  label       TEXT NOT NULL DEFAULT '',       -- e.g. "repaint chorus"
  params_json TEXT NOT NULL DEFAULT '{}',     -- full generation request for reproducibility
  seed        TEXT NOT NULL DEFAULT '',
  active      INTEGER NOT NULL DEFAULT 1,     -- exactly one active version per layer
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_layers_song ON layers(song_id);
CREATE INDEX IF NOT EXISTS idx_versions_layer ON versions(layer_id);
`;
