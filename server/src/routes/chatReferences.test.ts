/** Attaching a reference over HTTP (F-061 storage, F-062, D-130): upload, library pick, list, the thread view, NEW CHAT. */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import express from 'express';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chat-references-route-'));
process.env.COVER_MAX_UPLOAD_MB = '1';

const { config } = await import('../config.js');
const { db } = await import('../db/index.js');
const { resetDraftThread, songThread } = await import('../services/chat/threadStore.js');
const { makeChatRouter } = await import('./chat.js');
const { chatReferencesRouter } = await import('./chatReferences.js');

function wav(seconds = 1): Buffer {
  const data = Buffer.alloc(16000 * seconds);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(8000, 24); h.writeUInt32LE(16000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/chat', makeChatRouter({ status: async () => ({ configured: true, assistant: 'ok', cause: null, yue: 'ok' }), yueConfigured: () => true }));
  app.use('/api/chat', chatReferencesRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/chat`;
});
afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); });
afterEach(() => { resetDraftThread(); });

const call = async (method: string, route: string, body?: unknown) => {
  const res = await fetch(`${base}${route}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json() as Record<string, any> };
};
const send = async (threadId: string, data: Buffer, filename: string) => {
  const form = new FormData();
  form.append('audio', new Blob([new Uint8Array(data)]), filename);
  const res = await fetch(`${base}/threads/${threadId}/references`, { method: 'POST', body: form });
  return { status: res.status, body: await res.json() as Record<string, any> };
};
const refFile = (url: string) => path.join(config.audioDir, url.replace(/^\/audio\//, ''));

function librarySong(title: string): string {
  const songId = crypto.randomUUID();
  const layer = crypto.randomUUID();
  const version = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title, engine) VALUES (?, ?, 'yue2')`).run(songId, title);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind) VALUES (?, ?, 'Base', 'base')`).run(layer, songId);
  fs.writeFileSync(path.join(config.audioDir, `${version}.wav`), wav(2));
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file) VALUES (?, ?, ?)`).run(version, layer, `${version}.wav`);
  return songId;
}

describe('chat references routes', () => {
  it('upload: 201 with the reference; the thread view lists it; the file plays through /audio', async () => {
    const draft = (await call('GET', '/draft')).body;
    expect(draft.references).toEqual([]);
    const sent = await send(draft.id, wav(3), 'Kopf Hoch – Live.wav');
    expect(sent.status).toBe(201);
    expect(sent.body.reference).toMatchObject({ origin: 'upload', name: 'Kopf Hoch – Live.wav', sourceSongId: null, cut: false, layers: null, readAt: null, readingNote: null });
    expect(sent.body.reference.url).toMatch(/^\/audio\/references\/[0-9a-f-]+\.wav$/);
    expect(sent.body.reference.seconds).toBeCloseTo(3, 1);
    expect(fs.existsSync(refFile(sent.body.reference.url))).toBe(true);
    expect((await call('GET', `/threads/${draft.id}`)).body.references).toEqual([sent.body.reference]);
    expect((await call('GET', `/threads/${draft.id}/references`)).body).toEqual({ references: [sent.body.reference] });
    const again = await send(draft.id, wav(3), 'same.wav');
    expect(again).toMatchObject({ status: 200, body: { reference: { id: sent.body.reference.id } } });
  });

  it('a non-audio, unreadable or oversize file: a rust reason, nothing stored', async () => {
    const draft = (await call('GET', '/draft')).body;
    expect(await send(draft.id, Buffer.from('hello'), 'notes.txt')).toEqual({ status: 400, body: { reason: expect.stringContaining('not an audio file') } });
    expect(await send(draft.id, Buffer.from('garbage'), 'broken.mp3')).toEqual({ status: 400, body: { reason: expect.stringContaining('could not be read as audio') } });
    expect(await send(draft.id, Buffer.alloc(1024 * 1024 + 10), 'big.wav')).toEqual({ status: 413, body: { reason: 'the file is over 1 MB' } });
    const form = await fetch(`${base}/threads/${draft.id}/references`, { method: 'POST', body: new FormData() });
    expect(form.status).toBe(400);
    expect((await call('GET', `/threads/${draft.id}/references`)).body.references).toEqual([]);
  });

  it('library pick: 201 with the copy; an unknown song is a reason', async () => {
    const draft = (await call('GET', '/draft')).body;
    const songId = librarySong('Kopf Hoch');
    const picked = await call('POST', `/threads/${draft.id}/references/library`, { songId });
    expect(picked.status).toBe(201);
    expect(picked.body.reference).toMatchObject({ origin: 'library', name: 'Kopf Hoch', sourceSongId: songId, layers: 1 });
    expect(await call('POST', `/threads/${draft.id}/references/library`, { songId: 'nope' })).toEqual({ status: 400, body: { reason: 'that song is not in the library' } });
    expect((await call('POST', `/threads/${draft.id}/references/library`, {})).status).toBe(400);
  });

  it("a song's thread takes no new reference (D-130); an unknown thread is 404", async () => {
    const thread = songThread(librarySong('Done Song'));
    expect(await send(thread.id, wav(1), 'a.wav')).toMatchObject({ status: 409, body: { reason: expect.stringContaining('NEW CHAT') } });
    expect((await call('POST', `/threads/${thread.id}/references/library`, { songId: thread.songId })).status).toBe(409);
    expect((await call('GET', `/threads/${thread.id}/references`)).body).toEqual({ references: [] });
    expect((await send('nope', wav(1), 'a.wav')).status).toBe(404);
    expect((await call('GET', '/threads/nope/references')).status).toBe(404);
  });

  it('NEW CHAT drops the draft thread\'s references and their files', async () => {
    const draft = (await call('GET', '/draft')).body;
    const { body } = await send(draft.id, wav(2), 'gone.wav');
    const file = refFile(body.reference.url);
    const fresh = await call('POST', '/draft/reset');
    expect(fresh.body.references).toEqual([]);
    await vi.waitFor(() => expect(fs.existsSync(file)).toBe(false));
  });
});
