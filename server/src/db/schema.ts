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
  lyric_timestamps TEXT,                       -- JSON: aligned lyric line timestamps, or null if unavailable
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS voices (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  audio_file              TEXT NOT NULL,             -- filename inside audioDir
  duration                REAL,
  tags                    TEXT NOT NULL DEFAULT '',  -- comma-separated
  default_audio_influence REAL NOT NULL DEFAULT 0.5, -- 0.0-1.0, maps to audio_cover_strength
  default_style_influence REAL NOT NULL DEFAULT 0.5, -- 0.0-1.0, scales guidance_scale
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS output_metadata (
  id             INTEGER PRIMARY KEY CHECK (id = 1), -- single settings row, no per-user config
  artist         TEXT NOT NULL DEFAULT '',
  encoder        TEXT NOT NULL DEFAULT 'Mulakai + ACE-Step 1.5',
  album          TEXT NOT NULL DEFAULT '',
  genre          TEXT NOT NULL DEFAULT '',
  cover_art_file TEXT,                                -- filename inside audioDir, or null
  id3_version    TEXT NOT NULL DEFAULT '4'            -- '3' or '4'
);
INSERT OR IGNORE INTO output_metadata (id) VALUES (1);

CREATE INDEX IF NOT EXISTS idx_layers_song ON layers(song_id);
CREATE INDEX IF NOT EXISTS idx_versions_layer ON versions(layer_id);
`;
