/** SEND with a mark and WHAT IT SEES (C1, F-055, D-175, D-177): a pinned mark rides on the user message (the
 * echo); a stale one is 409 MARK_STALE `{error, reason, was, shift}` with nothing written; a bad one or one past
 * the song is 400; the preview's rows and AS SENT come from the same block a turn sends. */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import express from 'express';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chat-mark-test-'));

const { startFakeOllama } = await import('../../test-fakes/fakeOllama.js');
const { markAnalysis, sayReply } = await import('../../test-fakes/chatScripts.js');
const { db } = await import('../db/index.js');
const { getRunning, resetQueue } = await import('../services/genQueue.js');
const { draftThread, resetDraftThread, songThread } = await import('../services/chat/threadStore.js');
const { listMessages } = await import('../services/chat/messageStore.js');
const { writeAnalysis } = await import('../services/chat/analysisStore.js');
const { turnDeps } = await import('../services/chat/turnJob.js');
const { createDeps } = await import('../services/chat/createFromDraft.js');
const { MARK_ON_DRAFT, makeChatTurnsRouter } = await import('./chatTurns.js');
const { makeChatMarkRouter } = await import('./chatMark.js');
type UserBody = import('../services/chat/chatTypes.js').UserBody;

const ollama = await startFakeOllama();
ollama.chats.push(sayReply('Got it.'));
let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/chat', makeChatTurnsRouter({
    llmConfigured: () => true, create: () => createDeps(),
    turn: () => turnDeps({ planner: { url: ollama.url, model: 'qwen3:14b' }, rung: 0, source: { status: async () => { throw new Error('no yue'); } } }),
  }));
  app.use('/api/chat', makeChatMarkRouter());
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', () => r()));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/chat`;
});
afterEach(async () => { await vi.waitFor(() => expect(getRunning()).toBeNull()); resetQueue(); resetDraftThread(); });
afterAll(async () => { await ollama.close(); await new Promise<void>((r) => server.close(() => r())); });

const post = async (p: string, body: unknown) => {
  const res = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};
/** A song with v1 and, when `later` is given, v2 based on v1 with those score params (v2 active); both analyzed. */
function song(later?: object) {
  const songId = crypto.randomUUID();
  const layer = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title) VALUES (?, 'Rain')`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layer, songId);
  const ids = [crypto.randomUUID(), crypto.randomUUID()].slice(0, later ? 2 : 1);
  ids.forEach((id, i) => {
    const params = i ? { score_v: 1, engine: 'yue2', task_type: 'score', basedOn: ids[0], ...later } : {};
    db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, active, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, layer, `${id}.wav`, JSON.stringify(params), i === ids.length - 1 ? 1 : 0, `2026-10-0${i + 1}`);
    writeAnalysis(markAnalysis(id));
  });
  return { thread: songThread(songId), ids };
}
const mark = (versionId: string, over: object = {}) => ({ kind: 'range', versionId, bars: [47, 58], seconds: [126.5, 159.5], label: 'CHORUS 1 + 0 BARS', ...over });

describe('SEND with a mark (F-055)', () => {
  it('a pinned mark is frozen on the user message with its label (the echo)', async () => {
    const { thread, ids } = song();
    const r = await post(`/threads/${thread.id}/turns`, { text: 'make this jazzier', clientKey: crypto.randomUUID(), mark: mark(ids[0]) });
    expect(r.status).toBe(202);
    const user = listMessages(thread.id).find((m) => m.role === 'user')!;
    expect((user.body as UserBody).mark).toEqual(mark(ids[0]));
  });

  it('D-194: a seconds-only mark is snapped to the bars it covers and frozen with them (the echo names the bars)', async () => {
    const { thread, ids } = song();
    const r = await post(`/threads/${thread.id}/turns`, { text: 'make this jazzier', clientKey: crypto.randomUUID(),
      mark: { kind: 'range', versionId: ids[0], seconds: [126.5, 159.5], label: '2:07–2:40' } });
    expect(r.status).toBe(202);
    const user = listMessages(thread.id).find((m) => m.role === 'user')!;
    expect((user.body as UserBody).mark).toEqual({ kind: 'range', versionId: ids[0], bars: [47, 58], seconds: [126.5, 159.5], readAt: '2026-10-07T10:00:00.000Z' }); // counted on that reading (RT-5)
  });

  it('a stale mark is 409 MARK_STALE with the mark as sent and the shift, and nothing is written', async () => {
    const { thread, ids } = song({ ops: [{ op: 'CUT', section: 2, label: 'verse' }] });
    const r = await post(`/threads/${thread.id}/turns`, { text: 'make this jazzier', clientKey: crypto.randomUUID(), mark: mark(ids[0]) });
    expect(r).toEqual({ status: 409, body: {
      error: 'MARK_STALE', reason: 'your mark was on v1; v2 moved those bars', was: mark(ids[0]), shift: { atBar: 47, delta: -36 },
    } });
    expect(listMessages(thread.id)).toEqual([]);
  });

  it('a mark carried over a version that kept its bars is pinned on the new version, seconds re-timed', async () => {
    const { thread, ids } = song({ ops: [{ op: 'SET_TEMPO', bpm: 96 }] });
    const r = await post(`/threads/${thread.id}/turns`, { text: 'make this jazzier', clientKey: crypto.randomUUID(), mark: mark(ids[0], { seconds: [1, 2] }) });
    expect(r.status).toBe(202);
    const user = listMessages(thread.id).find((m) => m.role === 'user')!;
    expect((user.body as UserBody).mark).toMatchObject({ versionId: ids[1], bars: [47, 58], seconds: [126.5, 159.5] });
  });

  // C1 code review should 2: the turn right after APPLY runs before v2's analysis.
  it("across a SET TEMPO before the new version's bars are read: a bars mark and a time mark are 409, nothing written", async () => {
    const { thread, ids } = song({ ops: [{ op: 'SET_TEMPO', bpm: 120 }] });
    db.prepare(`UPDATE versions SET analysis_json = NULL WHERE id = ?`).run(ids[1]);
    const bars = await post(`/threads/${thread.id}/turns`, { text: 'make this jazzier', clientKey: crypto.randomUUID(), mark: mark(ids[0]) });
    expect(bars).toMatchObject({ status: 409, body: { error: 'MARK_STALE', reason: 'v2 changed the tempo and its bars are not read yet; mark again once its reading lands' } });
    const time = mark(ids[0], { bars: undefined, seconds: [30, 45] });
    const secs = await post(`/threads/${thread.id}/turns`, { text: 'make this jazzier', clientKey: crypto.randomUUID(), mark: time });
    expect(secs).toMatchObject({ status: 409, body: { error: 'MARK_STALE', reason: 'your mark was a time; v2 changed the tempo, so that time is different music now' } });
    expect(listMessages(thread.id)).toEqual([]);
  });

  it.each([
    ['reversed', (v: string) => mark(v, { seconds: [9, 2] }), 'mark must be'],
    ['past the song', (v: string) => mark(v, { bars: [60, 70] }), 'the mark reaches bar 70; the song has 65 bars'],
  ])('a mark %s is 400 and writes nothing', async (_, m, error) => {
    const { thread, ids } = song();
    const r = await post(`/threads/${thread.id}/turns`, { text: 'x', clientKey: crypto.randomUUID(), mark: m(ids[0]) });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain(error);
    expect(listMessages(thread.id)).toEqual([]);
  });

  it('a mark on the new-song chat is 400', async () => {
    const r = await post(`/threads/${draftThread().id}/turns`, { text: 'x', clientKey: crypto.randomUUID(), mark: mark('v') });
    expect(r).toEqual({ status: 400, body: { error: MARK_ON_DRAFT } });
  });
});

describe('WHAT IT SEES (D-177)', () => {
  it('answers the rows and AS SENT of the block a turn sends', async () => {
    const { thread, ids } = song();
    const r = await post(`/threads/${thread.id}/mark/preview`, { mark: mark(ids[0]) });
    expect(r.status).toBe(200);
    expect(r.body.rows.slice(0, 4)).toEqual([
      { name: 'VERSION', value: 'v1' }, { name: 'BARS', value: '47-58' }, { name: 'TIME', value: '2:07-2:40' }, // rounded as the chip (C1 live B5)
      { name: 'SECTIONS', value: 'CHORUS 1 (bars 47-58)' },
    ]);
    expect(r.body.sent).toMatchObject({ version: 1, versionId: ids[0], bars: [47, 58], key: 'Dm', bpm: 87 });
  });

  it('D-194: a seconds-only mark previews the bars it will be sent with', async () => {
    const { thread, ids } = song();
    const r = await post(`/threads/${thread.id}/mark/preview`, { mark: { kind: 'range', versionId: ids[0], seconds: [126.5, 159.5] } });
    expect(r.body.rows[1]).toEqual({ name: 'BARS', value: '47-58' });
    expect(r.body.sent).toMatchObject({ bars: [47, 58] });
  });

  it('a stale mark is 409 MARK_STALE; no mark is 400', async () => {
    const { thread, ids } = song({ ops: [{ op: 'REPEAT', section: 1, label: 'intro' }] });
    expect((await post(`/threads/${thread.id}/mark/preview`, { mark: mark(ids[0]) })).body).toMatchObject({ error: 'MARK_STALE', shift: { atBar: 11, delta: 10 } });
    expect((await post(`/threads/${thread.id}/mark/preview`, {})).status).toBe(400);
  });
});
