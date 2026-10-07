import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));

const { config } = await import('../config.js');
const { db } = await import('../db/index.js');
const { emptyTrashNow, sweepTrash } = await import('./trashSweep.js');

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

describe('chat reference files follow the song (D-127, F-062)', () => {
  it("a permanent delete removes the song thread's reference files; trash and other files stay", async () => {
    const refDir = path.join(config.audioDir, 'references');
    fs.mkdirSync(refDir, { recursive: true });
    seedSong('withref', daysAgo(1));
    seedSong('other', null);
    db.prepare(`INSERT INTO chat_threads (id, song_id) VALUES ('t-withref', 'withref'), ('t-other', 'other')`).run();
    const ref = db.prepare(`INSERT INTO chat_references (id, thread_id, origin, name, file, bytes, sha256) VALUES (?, ?, 'upload', 'a.wav', ?, 1, 'h')`);
    ref.run('ref-gone', 't-withref', 'references/ref-gone.wav');
    ref.run('ref-kept', 't-other', 'references/ref-kept.wav');
    fs.writeFileSync(path.join(refDir, 'ref-gone.wav'), 'x');
    fs.writeFileSync(path.join(refDir, 'ref-kept.wav'), 'x');

    sweepTrash(); // trashed a day ago: kept, with its reference
    await new Promise((r) => setTimeout(r, 20));
    expect(fs.existsSync(path.join(refDir, 'ref-gone.wav'))).toBe(true);

    emptyTrashNow();
    await vi.waitFor(() => expect(fs.existsSync(path.join(refDir, 'ref-gone.wav'))).toBe(false));
    expect(fs.existsSync(path.join(refDir, 'ref-kept.wav'))).toBe(true);
  });
});
