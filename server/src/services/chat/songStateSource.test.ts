/** A turn's state with references (C3, temp DATA_DIR): ATTACHED until read, the REFERENCE block after, analyzeFor's READ card. */
import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-state-source-'));

const { db } = await import('../../db/index.js');
const { readingFixture } = await import('../../../test-fakes/chatScripts.js');
const { draftThread, resetDraftThread, songThread } = await import('./threadStore.js');
const { analyzeFor, gatherTurnState } = await import('./songStateSource.js');

function addRef(threadId: string, name: string, over: { reading?: unknown; sourceSongId?: string; seconds?: number } = {}): string {
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO chat_references (id, thread_id, origin, name, source_song_id, file, bytes, sha256, seconds, reading_json) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`)
    .run(id, threadId, over.sourceSongId ? 'library' : 'upload', name, over.sourceSongId ?? null, `references/${id}.wav`, id, over.seconds ?? 200,
      over.reading ? JSON.stringify(over.reading) : null);
  return id;
}
const song = (title: string, duration = 150) => {
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title, duration, engine) VALUES (?, ?, ?, 'yue2')`).run(id, title, duration);
  return id;
};
const plan = () => ({ words: 'service', score: 'service', caption: 'service' } as const);
const noStatus = { status: async () => { throw new Error('not used'); } };

beforeEach(() => { resetDraftThread(); });

describe('gatherTurnState with references', () => {
  it('nothing attached: the state is as before, no C3 lines', async () => {
    const got = await gatherTurnState(draftThread(), noStatus);
    expect(got.block.join('\n')).not.toMatch(/ATTACHED|REFERENCE/);
    expect(got.state).toEqual({ hasSong: false, scoreReadable: false });
    expect(got.refs.reading).toBeNull();
  });

  it('an unread attach is an ATTACHED line; a read one is the REFERENCE block and the recipe\'s reading', async () => {
    const thread = draftThread();
    const read = addRef(thread.id, 'old.mp3', { reading: readingFixture() });
    addRef(thread.id, 'new.mp3', { seconds: 192 });
    const got = await gatherTurnState(thread, noStatus, { attach: 'x' });
    const text = got.block.join('\n');
    expect(text).toContain('ATTACHED: "new.mp3" (3:12, not read yet)');
    expect(text).toContain('REFERENCE: "old.mp3"');
    expect(got.state).toEqual({ hasSong: false, scoreReadable: false, attached: true, referenceRead: true });
    expect(got.refs).toMatchObject({ attach: 'x', reading: { id: read } });
  });

  it('a follow-up uses its own reference\'s reading and allows the follow-up actions', async () => {
    const thread = draftThread();
    const first = addRef(thread.id, 'a.mp3', { reading: readingFixture() });
    addRef(thread.id, 'b.mp3', { reading: readingFixture({ seconds: 100, readTo: 100 }) });
    const got = await gatherTurnState(thread, noStatus, { followUp: first });
    expect(got.refs.reading?.id).toBe(first);
    expect(got.block.join('\n')).toContain('REFERENCE: "a.mp3"');
    expect(got.state.followUp).toBe(true);
  });

  it('no follow-up: the latest-read reference, not the newest row (RE-ANALYZE of an older one)', async () => {
    const thread = draftThread();
    const older = addRef(thread.id, 'a.mp3', { reading: readingFixture({ readAt: '2026-10-07T12:00:00.000Z' }) });
    addRef(thread.id, 'b.mp3', { reading: readingFixture({ readAt: '2026-10-07T11:00:00.000Z' }) });
    const got = await gatherTurnState(thread, noStatus);
    expect(got.refs.reading?.id).toBe(older);
    expect(got.block.join('\n')).toContain('REFERENCE: "a.mp3"');
  });

  it('a song thread keeps the REFERENCE block for context but no reading for a recipe (D-130)', async () => {
    const songId = song('Done song');
    const thread = songThread(songId);
    addRef(thread.id, 'src.mp3', { reading: readingFixture() });
    const got = await gatherTurnState(thread, { status: async () => { throw new Error('yue-server did not answer'); } });
    expect(got.block.join('\n')).toContain('REFERENCE: "src.mp3"');
    expect(got.refs.reading).toBeNull();
    expect(got.state.referenceRead).toBeUndefined();
  });
});

describe('analyzeFor (the READ card)', () => {
  it('an attached file: its name, length and estimate', async () => {
    const thread = draftThread();
    const id = addRef(thread.id, 'demo.mp3', { seconds: 400 });
    const { refs } = await gatherTurnState(thread, noStatus, { attach: id });
    expect(analyzeFor('whatever', refs, plan)).toEqual({ body: expect.objectContaining({ target: { referenceId: id }, name: 'demo.mp3', seconds: 400, readTo: 360, cut: true }) });
  });

  it('a library song named in words: its title and duration, not copied yet', async () => {
    const songId = song('Sternenlicht', 210);
    const { refs } = await gatherTurnState(draftThread(), noStatus);
    expect(analyzeFor('sternenlicht', refs, plan)).toEqual({ body: expect.objectContaining({ target: { songId }, name: 'Sternenlicht', seconds: 210, cut: false }) });
  });

  it('nothing to read: the reason and what is attached', async () => {
    const { refs } = await gatherTurnState(draftThread(), noStatus);
    expect(analyzeFor('Bohemian Rhapsody', refs, plan)).toEqual({ reason: 'nothing called "Bohemian Rhapsody" is attached or in the library', attached: [] });
  });
});
