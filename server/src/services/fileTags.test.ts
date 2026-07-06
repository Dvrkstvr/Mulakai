import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));

const fakeTag: Record<string, unknown> = {};
const fakeId3Tag = { setTextFrame: vi.fn() };
const fakeFile = { tag: fakeTag, getTag: vi.fn(() => fakeId3Tag), save: vi.fn(), dispose: vi.fn() };
const createFromPath = vi.fn(() => fakeFile);
const idSettings = { defaultVersion: 4, forceDefaultVersion: false };

vi.mock('node-taglib-sharp', () => ({
  File: { createFromPath: (...args: unknown[]) => createFromPath(...args) },
  Id3v2Settings: idSettings,
  Id3v2FrameIdentifiers: { TENC: 'TENC' },
  TagTypes: { Id3v2: 4 },
  Picture: { fromPath: vi.fn(() => ({ mimeType: 'image/png' })) },
}));

const { db } = await import('../db/index.js');
const { updateOutputMetadata } = await import('./outputMetadata.js');
const { tagOutputFile, retagSong } = await import('./fileTags.js');

beforeEach(() => {
  createFromPath.mockClear();
  fakeId3Tag.setTextFrame.mockClear();
  fakeFile.save.mockClear();
  fakeFile.dispose.mockClear();
  for (const k of Object.keys(fakeTag)) delete fakeTag[k];
  updateOutputMetadata({ artist: '', encoder: 'Mulakai + ACE-Step 1.5', id3Version: '4' });
});

describe('tagOutputFile', () => {
  it('sets title/bpm/key/comment/genre/album from the per-song fields, artist from the global default', async () => {
    updateOutputMetadata({ artist: 'Copper Sky' });
    await tagOutputFile('/tmp/song.mp3', {
      title: 'Midnight Static', bpm: 128, keyScale: 'A minor', comment: 'v3 take', genre: 'synthwave', album: 'Demos',
    });

    expect(fakeTag.title).toBe('Midnight Static');
    expect(fakeTag.performers).toEqual(['Copper Sky']);
    expect(fakeTag.album).toBe('Demos');
    expect(fakeTag.genres).toEqual(['synthwave']);
    expect(fakeTag.comment).toBe('v3 take');
    expect(fakeTag.beatsPerMinute).toBe(128);
    expect(fakeTag.initialKey).toBe('A minor');
    expect(fakeFile.save).toHaveBeenCalledTimes(1);
    expect(fakeFile.dispose).toHaveBeenCalledTimes(1);
  });

  it('writes the encoder via the raw ID3v2 TENC frame, not a Tag property', async () => {
    updateOutputMetadata({ encoder: 'Mulakai + ACE-Step 1.5' });
    await tagOutputFile('/tmp/song.mp3', { title: 'x' });
    expect(fakeId3Tag.setTextFrame).toHaveBeenCalledWith('TENC', 'Mulakai + ACE-Step 1.5');
  });

  it('applies the configured ID3 version via Id3v2Settings before writing', async () => {
    updateOutputMetadata({ id3Version: '3' });
    await tagOutputFile('/tmp/song.mp3', { title: 'x' });
    expect(idSettings.defaultVersion).toBe(3);
    expect(idSettings.forceDefaultVersion).toBe(true);
  });

  it('embeds a per-song cover art file when provided', async () => {
    await tagOutputFile('/tmp/song.mp3', { title: 'x', coverArtFile: 'some-song-cover.png' });
    expect(fakeTag.pictures).toBeTruthy();
  });

  it('swallows tagging errors instead of throwing (must never break a generation job)', async () => {
    createFromPath.mockImplementationOnce(() => { throw new Error('unsupported file'); });
    await expect(tagOutputFile('/tmp/whatever.xyz', { title: 'x' })).resolves.toBeUndefined();
  });
});

describe('retagSong', () => {
  it("re-tags every active version file across all of a song's layers, including genre/album/cover art", async () => {
    const songId = crypto.randomUUID();
    const layerId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO songs (id, title, caption, bpm, key_scale, comment, genre, album, cover_art_file)
       VALUES (?, 'Renamed Title', '', 120, 'C major', 'new comment', 'ambient', 'Demos', 'cover.png')`,
    ).run(songId);
    db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layerId, songId);
    db.prepare(
      `INSERT INTO versions (id, layer_id, audio_file, active) VALUES (?, ?, 'v1.mp3', 1)`,
    ).run(crypto.randomUUID(), layerId);

    await retagSong(songId);

    expect(fakeTag.title).toBe('Renamed Title');
    expect(fakeTag.comment).toBe('new comment');
    expect(fakeTag.genres).toEqual(['ambient']);
    expect(fakeTag.album).toBe('Demos');
    expect(fakeTag.pictures).toBeTruthy();
  });

  it('is a no-op for an unknown song', async () => {
    createFromPath.mockClear();
    await retagSong(crypto.randomUUID());
    expect(createFromPath).not.toHaveBeenCalled();
  });
});
