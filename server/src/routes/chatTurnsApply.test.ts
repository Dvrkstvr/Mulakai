/** POST /api/chat/threads/:id/apply and CANCEL of an APPLY (CB-3, F-047, F-049 #1 and edge), over the real
 * editCommit and chat edit job against fakeYue (the YuE2 render held running). Temp DATA_DIR. */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chat-apply-test-'));
process.env.POLL_INTERVAL_MS = '5';

const { db } = await import('../db/index.js');
const { config } = await import('../config.js');
const { spliceContract, startFakeYue } = await import('../../test-fakes/fakeYue.js');
const { getRunning, resetQueue } = await import('../services/genQueue.js');
const { getJob } = await import('../services/jobRegistry.js');
const { writeScoreSidecar } = await import('../services/versionFiles.js');
const { resetPlans, setPlan, getPlan } = await import('../services/score/planStore.js');
const { loadScoreSource } = await import('../services/score/scoreSource.js');
const { scoreStatus } = await import('../services/score/scoreStatus.js');
const { renderDeps } = await import('../services/score/scoreRenderJob.js');
const { appendMessage, listMessages } = await import('../services/chat/messageStore.js');
const { messageViews } = await import('../services/chat/messageView.js');
const { propose, proposalLife, resetProposals } = await import('../services/chat/proposalStore.js');
const { songThread } = await import('../services/chat/threadStore.js');
const { createDeps } = await import('../services/chat/createFromDraft.js');
const { editCommitDeps, STALE } = await import('../services/chat/editCommit.js');
const { turnDeps } = await import('../services/chat/turnJob.js');
const { makeChatTurnsRouter } = await import('./chatTurns.js');
type Op = import('../services/score/planTypes.js').Op;

const OK = spliceContract('splice-ok');
const BASE_ABC = OK.request.form.spec.base_abc as string;
const REHARM = OK.request.form.spec.op as Op;
const read = { ok: true, error: null, messages: [], chordsPresent: true, bpm: 120, seconds: 48, tokens: 900, facts: null };

const yue = await startFakeYue([]);
let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/chat', makeChatTurnsRouter({
    llmConfigured: () => true, create: () => createDeps(), turn: () => turnDeps(),
    apply: () => editCommitDeps({ render: renderDeps({
      target: { label: 'YUE2', url: yue.url, apiKey: '' },
      status: (songId) => scoreStatus(songId, { plannerConfigured: true, yueConfigured: true, read: async () => read as never }),
      loaded: async () => [],
    }) }),
  }));
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', () => r()));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/chat`;
});
afterEach(() => { resetQueue(); resetPlans(); resetProposals(); });
afterAll(async () => { await yue.close(); await new Promise<void>((r) => server.close(() => r())); });

const post = async (p: string, body: unknown = {}) => {
  const res = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};

async function seed() {
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title, lyrics, bpm, gen_task, engine) VALUES (?, 'Luz', '[verse]\nla', 120, 'text2music', 'yue2')`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layerId, songId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, seed, active) VALUES (?, ?, ?, ?, '7', 1)`).run(versionId, layerId, `${versionId}.flac`,
    JSON.stringify({ engine: 'yue2', task_type: 'text2music', request: { style: 'pop', lyrics: '[verse]\nla', seed: 7 } }));
  fs.writeFileSync(path.join(config.audioDir, `${versionId}.flac`), 'fLaC-base');
  await writeScoreSidecar(versionId, BASE_ABC);
  const source = (await loadScoreSource(songId))!;
  const planId = `plan-${songId}`;
  setPlan({
    id: planId, songId, baseVersionId: versionId, fingerprint: source.fingerprint, request: 'jazz', ops: [REHARM], verdicts: [], abc: BASE_ABC, style: 'pop',
    checks: { bars: 24, seconds: 48, tokens: 900, chordsPresent: true, changed: { abc: true, style: false } }, attempts: 1, refusals: [], createdAt: 0,
    renderMode: { cot: 'full', reason: 'chords' },
  });
  const thread = songThread(songId);
  const proposalId = crypto.randomUUID();
  const { message } = appendMessage(thread.id, {
    role: 'assistant', kind: 'edit', text: 'Jazz chords.', proposalId,
    body: { planId, ops: [REHARM], verdicts: [], checks: {} as never, splice: { splice: true, kind: 'reharmonize', from_bar: 9, to_bar: 16 },
      renderMode: { cot: 'full', reason: 'chords' }, assumptions: [], attempts: 1, refusals: [] },
  });
  propose({ id: proposalId, threadId: thread.id, messageId: message.id, createdAt: 0, kind: 'edit', planId });
  return { songId, layerId, threadId: thread.id, proposalId };
}
const states = (threadId: string) => messageViews(listMessages(threadId), { job: (id) => getJob(id) as never, proposal: proposalLife }).map((m) => m.state);

describe('POST /threads/:id/apply', () => {
  it('400 without a proposal id, 404 for an unknown chat, 409 with the reason for an expired card', async () => {
    const { threadId } = await seed();
    expect((await post(`/threads/${threadId}/apply`, {})).status).toBe(400);
    expect((await post('/threads/nope/apply', { proposalId: 'x' })).status).toBe(404);
    expect(await post(`/threads/${threadId}/apply`, { proposalId: 'gone' })).toEqual({ status: 409, body: { reason: 'this proposal expired: ask again', stale: false } });
  });

  it('202 with the job; CANCEL while rendering aborts it, saves no version and the card is pending again (F-049 #1)', async () => {
    const { threadId, proposalId, layerId, songId } = await seed();
    yue.job = { states: [{ status: 'running', stage: 'semantic' }] };
    const out = await post(`/threads/${threadId}/apply`, { proposalId });
    expect(out.status).toBe(202);
    expect(getRunning()).toMatchObject({ jobId: out.body.jobId, kind: 'scoreRender', label: 'chat edit' });
    expect(states(threadId)).toEqual(['committing']);
    await vi.waitFor(() => expect(getJob(out.body.jobId)?.status).toBe('running'));
    expect(await post(`/jobs/${out.body.jobId}/cancel`)).toEqual({ status: 200, body: { ok: true, aborted: true } });
    // Cancelled, not a plain failure: the client reads `cancelled`, not the registry's 'Aborted' text.
    expect(getJob(out.body.jobId)).toMatchObject({ status: 'failed', cancelled: true });
    await vi.waitFor(() => expect(getRunning()).toBeNull(), { timeout: 5000 });
    expect(db.prepare(`SELECT COUNT(*) AS n FROM versions WHERE layer_id = ?`).get(layerId)).toEqual({ n: 1 });
    expect(getPlan(songId)).toBeDefined();
    expect(states(threadId)).toEqual(['pending']);
    // Nothing saved: the card dropped its job id, so after a restart it reads EXPIRED, not INTERRUPTED.
    expect(listMessages(threadId)[0].jobId).toBeNull();
    resetProposals();
    expect(states(threadId)).toEqual(['expired']);
  });

  it('a restart mid-APPLY (proposal and job forgotten) reads INTERRUPTED; a queued APPLY cancelled clears its card (F-049 #3)', async () => {
    const first = await seed();
    const second = await seed();
    yue.job = { states: [{ status: 'running', stage: 'semantic' }] };
    const running = await post(`/threads/${first.threadId}/apply`, { proposalId: first.proposalId });
    const queued = await post(`/threads/${second.threadId}/apply`, { proposalId: second.proposalId });
    expect(getJob(queued.body.jobId)?.status).toBe('queued');
    expect(await post(`/jobs/${queued.body.jobId}/cancel`)).toEqual({ status: 200, body: { ok: true, cancelled: true } });
    expect(listMessages(second.threadId)[0].jobId).toBeNull();
    resetProposals(); // the restart: proposals and the job registry are memory only
    const restarted = (threadId: string) => messageViews(listMessages(threadId), { job: () => undefined, proposal: proposalLife }).map((m) => m.state);
    expect(restarted(first.threadId)).toEqual(['interrupted']);
    expect(restarted(second.threadId)).toEqual(['expired']);
    expect(await post(`/jobs/${running.body.jobId}/cancel`)).toMatchObject({ status: 200 });
    await vi.waitFor(() => expect(getRunning()).toBeNull(), { timeout: 5000 });
  });

  it('409 stale when the song changed since the proposal; no job starts (F-049 edge)', async () => {
    const { threadId, proposalId, layerId } = await seed();
    db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, active) VALUES (?, ?, 'x.flac', '{"engine":"yue2"}', 0)`).run(crypto.randomUUID(), layerId);
    expect(await post(`/threads/${threadId}/apply`, { proposalId })).toEqual({ status: 409, body: { reason: STALE, stale: true } });
    expect(getRunning()).toBeNull();
    expect(states(threadId)).toEqual(['stale']);
  });
});
