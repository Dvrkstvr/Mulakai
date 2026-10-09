/** POST /api/chat/threads/:id/versions/:versionId/rerender (F-066 #5, D-268) over the real rerenderWhole. Temp DATA_DIR. */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chat-rerender-test-'));

const { db } = await import('../db/index.js');
const { spliceContract } = await import('../../test-fakes/fakeYue.js');
const { registerJob } = await import('../services/jobRegistry.js');
const { writeScoreSidecar } = await import('../services/versionFiles.js');
const { resetPlans } = await import('../services/score/planStore.js');
const { scoreStatus } = await import('../services/score/scoreStatus.js');
const { appendMessage, listMessages } = await import('../services/chat/messageStore.js');
const { resetProposals } = await import('../services/chat/proposalStore.js');
const { songThread } = await import('../services/chat/threadStore.js');
const { createDeps } = await import('../services/chat/createFromDraft.js');
const { turnDeps } = await import('../services/chat/turnJob.js');
const { notSpliced } = await import('../services/chat/rerenderWhole.js');
const { makeChatTurnsRouter, TURN_OPEN } = await import('./chatTurns.js');

const BASE_ABC = spliceContract('splice-ok').request.form.spec.base_abc as string;
const facts = {
  header: { meter: '4/4', unit: '1/8', bpm: 120, key: 'C', bars: 24, seconds: 48, units_per_quarter: 2 },
  key_notes: '', sections: [], lyric_blocks: [], bar_map: [],
};
const read = { ok: true, error: null, messages: [], chordsPresent: true, bpm: 120, seconds: 48, tokens: 900, facts };

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/chat', makeChatTurnsRouter({
    llmConfigured: () => true, create: () => createDeps(), turn: () => turnDeps(),
    rerender: () => ({ status: (songId) => scoreStatus(songId, { plannerConfigured: true, yueConfigured: true, read: async () => read as never }) }),
  }));
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', () => r()));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/chat`;
});
afterEach(() => { resetPlans(); resetProposals(); });
afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); });

const post = async (p: string) => {
  const res = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  return { status: res.status, body: await res.json() };
};

async function seed(splice: unknown) {
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title, lyrics, bpm, gen_task, engine) VALUES (?, 'Luz', '[verse]\nla', 120, 'text2music', 'yue2')`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layerId, songId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, seed, active) VALUES (?, ?, ?, ?, '7', 1)`).run(versionId, layerId, `${versionId}.flac`,
    JSON.stringify({ engine: 'yue2', task_type: 'text2music', request: { style: 'pop', lyrics: '[verse]\nla', seed: 7 }, splice }));
  await writeScoreSidecar(versionId, BASE_ABC);
  const thread = songThread(songId);
  appendMessage(thread.id, { role: 'assistant', kind: 'version', text: 'Saved as v2', versionId, body: { number: 2 } as never });
  return { threadId: thread.id, versionId };
}
const SPLICED = { splice_v: 1, kind: 'repeat', bars: [9, 16] };

describe('POST /threads/:id/versions/:versionId/rerender', () => {
  it('201: the pending whole-song edit card is in the thread', async () => {
    const { threadId, versionId } = await seed(SPLICED);
    const res = await post(`/threads/${threadId}/versions/${versionId}/rerender`);
    expect(res.status).toBe(201);
    expect(listMessages(threadId).at(-1)).toMatchObject({ id: res.body.messageId, kind: 'edit', proposalId: res.body.proposalId });
  });

  it('409 with the reason: a version that was not spliced', async () => {
    const { threadId, versionId } = await seed({ splice_v: 1, fallback: 'the join could not be aligned' });
    expect(await post(`/threads/${threadId}/versions/${versionId}/rerender`)).toEqual({ status: 409, body: { error: notSpliced(2), reason: notSpliced(2) } });
  });

  it('409 TURN_OPEN while a turn answers in this chat; nothing written', async () => {
    const { threadId, versionId } = await seed(SPLICED);
    const job = { id: crypto.randomUUID(), taskId: '', status: 'running' as const, createdAt: Date.now() };
    registerJob(job);
    appendMessage(threadId, { role: 'user', kind: 'text', text: 'hi', body: { sentRev: 0 }, jobId: job.id });
    const res = await post(`/threads/${threadId}/versions/${versionId}/rerender`);
    expect(res).toEqual({ status: 409, body: { error: TURN_OPEN, reason: TURN_OPEN } });
    expect(listMessages(threadId).filter((m) => m.kind === 'edit')).toEqual([]);
  });

  it('404: an unknown chat, or a version with no card in it', async () => {
    const { threadId } = await seed(SPLICED);
    expect((await post(`/threads/nope/versions/x/rerender`)).status).toBe(404);
    expect((await post(`/threads/${threadId}/versions/${crypto.randomUUID()}/rerender`)).status).toBe(404);
  });
});
