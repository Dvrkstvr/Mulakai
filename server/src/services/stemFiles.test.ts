import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));

const { config } = await import('../config.js');
const { db } = await import('../db/index.js');
const { sweepOrphanStems, discardUnclaimedFile } = await import('./stemFiles.js');

const write = (file: string) => fs.writeFileSync(path.join(config.audioDir, file), file);
const exists = (file: string) => fs.existsSync(path.join(config.audioDir, file));

/** A version row pointing at `file`, as a REPLACE / ADD LAYER claim leaves behind. */
function claim(file: string): void {
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title) VALUES (?, 'Song')`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name) VALUES (?, ?, 'Vocals')`).run(layerId, songId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file) VALUES (?, ?, ?)`).run(crypto.randomUUID(), layerId, file);
}

describe('sweepOrphanStems', () => {
  it('removes unclaimed stems of dead jobs, both name shapes, and keeps claimed ones', async () => {
    const job = crypto.randomUUID();
    const orphan = `${job}-drums-1a2b3c4d.flac`;
    const legacy = `${job}-bass.mp3`;
    const claimed = `${job}-vocals-0f0f0f0f.flac`;
    [orphan, legacy, claimed].forEach(write);
    claim(claimed);

    const removed = await sweepOrphanStems(() => false);

    expect(removed).toBe(2);
    expect(exists(orphan)).toBe(false);
    expect(exists(legacy)).toBe(false);
    expect(exists(claimed)).toBe(true);
  });

  it('never touches files that are not stems, even with no version row', async () => {
    const id = crypto.randomUUID();
    const others = [`${id}.flac`, `${id}-cover.png`, `${id}.abc`, `${id}-vocals.txt.bak`, 'notes-vocals-12345678.wav'];
    others.forEach(write);

    await sweepOrphanStems(() => false);

    for (const f of others) expect(exists(f)).toBe(true);
  });

  it('leaves a live split job\'s unclaimed stems alone', async () => {
    const live = crypto.randomUUID();
    const dead = crypto.randomUUID();
    const liveStem = `${live}-other-aaaaaaaa.wav`;
    const deadStem = `${dead}-other-bbbbbbbb.wav`;
    [liveStem, deadStem].forEach(write);

    await sweepOrphanStems((id) => id === live);

    expect(exists(liveStem)).toBe(true);
    expect(exists(deadStem)).toBe(false);
  });
});

describe('discardUnclaimedFile', () => {
  it('deletes an unreferenced file but never one a version points at', async () => {
    const free = `${crypto.randomUUID()}-drums-11111111.flac`;
    const held = `${crypto.randomUUID()}-drums-22222222.flac`;
    [free, held].forEach(write);
    claim(held);

    await discardUnclaimedFile(free);
    await discardUnclaimedFile(held);
    await discardUnclaimedFile(undefined);

    expect(exists(free)).toBe(false);
    expect(exists(held)).toBe(true);
  });
});
