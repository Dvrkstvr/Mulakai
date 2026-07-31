import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));

const { config } = await import('../config.js');
const { db } = await import('../db/index.js');
const { sweepTrash } = await import('./trashSweep.js');

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

/** One song with one layer/version audio file and a cover-art file, both on disk. */
function seedSong(id: string, trashedAt: string | null) {
  const audioFile = `${id}-take.wav`;
  const coverFile = `${id}-cover.png`;
  fs.writeFileSync(path.join(config.audioDir, audioFile), 'audio bytes');
  fs.writeFileSync(path.join(config.audioDir, coverFile), 'png bytes');
  db.prepare(`INSERT INTO songs (id, title, trashed_at, cover_art_file) VALUES (?, ?, ?, ?)`)
    .run(id, `Song ${id}`, trashedAt, coverFile);
  db.prepare(`INSERT INTO layers (id, song_id, name) VALUES (?, ?, 'base')`).run(`${id}-l`, id);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file) VALUES (?, ?, ?)`)
    .run(`${id}-v`, `${id}-l`, audioFile);
  return { audioFile: path.join(config.audioDir, audioFile), coverFile: path.join(config.audioDir, coverFile) };
}

describe('sweepTrash', () => {
  it('permanently deletes expired songs with their version audio and cover art', async () => {
    const expired = seedSong('old', daysAgo(8));

    sweepTrash();

    expect(db.prepare(`SELECT id FROM songs WHERE id = 'old'`).get()).toBeUndefined();
    // File deletion is fire-and-forget (void fs.rm), so poll rather than assert immediately.
    await vi.waitFor(() => {
      expect(fs.existsSync(expired.audioFile)).toBe(false);
      expect(fs.existsSync(expired.coverFile)).toBe(false);
    });
  });

  it('leaves recently trashed and untrashed songs alone', () => {
    const fresh = seedSong('fresh', daysAgo(1));
    const kept = seedSong('kept', null);

    sweepTrash();

    expect(db.prepare(`SELECT id FROM songs WHERE id = 'fresh'`).get()).toBeDefined();
    expect(db.prepare(`SELECT id FROM songs WHERE id = 'kept'`).get()).toBeDefined();
    expect(fs.existsSync(fresh.audioFile)).toBe(true);
    expect(fs.existsSync(fresh.coverFile)).toBe(true);
    expect(fs.existsSync(kept.audioFile)).toBe(true);
  });

  it('survives a version audio file that is already gone', () => {
    const ghost = seedSong('ghost', daysAgo(30));
    fs.rmSync(ghost.audioFile);

    expect(() => sweepTrash()).not.toThrow();
    expect(db.prepare(`SELECT id FROM songs WHERE id = 'ghost'`).get()).toBeUndefined();
  });
});
