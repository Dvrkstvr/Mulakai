/** APPLY at the click (F-047, F-048 #1, F-049 #1 and edge): the re-checks, then the job; the version card follows
 * the saved version. Real genQueue, temp DATA_DIR, fakeYue replaying CB-1's splices. */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-editcommit-test-'));
process.env.POLL_INTERVAL_MS = '5';

vi.mock('../transcode.js', () => ({
  transcodeBuffer: async (master: Buffer, outPath: string) => { await (await import('node:fs/promises')).writeFile(outPath, master); },
  transcodeFile: async () => {},
  probeFfmpeg: async () => true,
}));

const { db } = await import('../../db/index.js');
const { config } = await import('../../config.js');
const { spliceContract, startFakeYue } = await import('../../../test-fakes/fakeYue.js');
const { enqueue, getRunning, releaseSlot, resetQueue } = await import('../genQueue.js');
const { getJob } = await import('../jobRegistry.js');
const { writeScoreSidecar } = await import('../versionFiles.js');
const { resetPlans, setPlan } = await import('../score/planStore.js');
const { loadScoreSource } = await import('../score/scoreSource.js');
const { scoreStatus } = await import('../score/scoreStatus.js');
const { renderDeps } = await import('../score/scoreRenderJob.js');
const { appendMessage, listMessages } = await import('./messageStore.js');
const { messageViews } = await import('./messageView.js');
const { propose, resetProposals } = await import('./proposalStore.js');
const { songThread } = await import('./threadStore.js');
const { applyEdit, editCommitDeps, STALE } = await import('./editCommit.js');
type FakeYue = Awaited<ReturnType<typeof startFakeYue>>;
type Op = import('../score/planTypes.js').Op;
type Splice = import('./spliceEligibility.js').Splice;
type LoadedModel = import('../score/ollamaControl.js').LoadedModel;

const OK = spliceContract('splice-ok');
const BASE_ABC = OK.request.form.spec.base_abc as string;
const REHARM = OK.request.form.spec.op as Op;
const read = { ok: true, error: null, messages: [], chordsPresent: true, bpm: 120, seconds: 48, tokens: 900, facts: null };

let yue: FakeYue;
let loaded: LoadedModel[] = [];
beforeAll(async () => { yue = await startFakeYue([]); });
afterAll(async () => { await yue.close(); });
afterEach(() => { resetQueue(); resetPlans(); resetProposals(); loaded = []; yue.splice = { fixture: spliceContract('splice-ok'), specs: [], cancelled: new Set() }; });

const deps = () => editCommitDeps({
  render: renderDeps({
    target: { label: 'YUE2', url: yue.url, apiKey: '' },
    status: (songId) => scoreStatus(songId, { plannerConfigured: true, yueConfigured: true, read: async () => read as never }),
    loaded: async () => loaded,
  }),
});

async function seed(splice: Splice = { splice: true, kind: 'reharmonize', from_bar: 9, to_bar: 16 }) {
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
    id: planId, songId, baseVersionId: versionId, fingerprint: source.fingerprint, request: 'jazz chords', ops: [REHARM], verdicts: [], abc: BASE_ABC, style: 'pop',
    checks: { bars: 24, seconds: 48, tokens: 900, chordsPresent: true, changed: { abc: true, style: false } }, attempts: 1, refusals: [], createdAt: 0,
    renderMode: { cot: 'full', reason: 'chords' },
  });
  const thread = songThread(songId);
  const proposalId = crypto.randomUUID();
  const { message } = appendMessage(thread.id, {
    role: 'assistant', kind: 'edit', text: 'Jazz chords in bars 9-16.', proposalId,
    body: { planId, ops: [REHARM], verdicts: [], checks: { bars: 24 } as never, splice, renderMode: { cot: 'full', reason: 'chords' }, assumptions: [], attempts: 1, refusals: [] },
  });
  propose({ id: proposalId, threadId: thread.id, messageId: message.id, createdAt: 0, kind: 'edit', planId });
  return { songId, layerId, versionId, threadId: thread.id, proposalId, cardId: message.id };
}

const settled = async (id: string) => {
  await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(id)?.status), { timeout: 5000 });
  await vi.waitFor(() => expect(getRunning()).toBeNull(), { timeout: 5000 });
};
const view = (threadId: string) => messageViews(listMessages(threadId), {
  job: (id) => getJob(id) as never, proposal: () => 'live',
});

describe('applyEdit', () => {
  it('APPLY starts the chat edit, the card commits, and the version card follows the saved splice (F-047, F-048 #1)', async () => {
    const { threadId, proposalId, cardId, versionId } = await seed();
    const out = await applyEdit(threadId, proposalId, deps());
    if (!('job' in out)) throw new Error(out.reason);
    expect(getRunning()).toMatchObject({ kind: 'scoreRender', label: 'chat edit' });
    expect(listMessages(threadId).find((m) => m.id === cardId)?.jobId).toBe(out.job.id);
    await settled(out.job.id);
    const [card, version] = view(threadId);
    expect(card.state).toBe('done');
    expect(version).toMatchObject({
      role: 'assistant', kind: 'version', jobId: out.job.id, text: 'Saved as v2: bars 9-16 changed, the rest is v1\'s audio.',
      body: { chat_v: 1, number: 2, whole: false, splice: { kind: 'reharmonize', bars: [9, 16], lengthDiffS: 0 }, fallback: null, previous: { versionId, number: 1 } },
    });
    expect(version.versionId).toBeTruthy();
  });

  it('a whole-song card renders the whole song and its version card says so', async () => {
    const { threadId, proposalId } = await seed({ splice: false, reason: 'the plan makes 2 changes' });
    const out = await applyEdit(threadId, proposalId, deps());
    if (!('job' in out)) throw new Error(out.reason);
    await settled(out.job.id);
    expect(yue.splice.specs).toEqual([]);
    expect(view(threadId)[1]).toMatchObject({ kind: 'version', body: { whole: true, splice: null, fallback: null } });
  });

  it('the song changed since the proposal: refused, no job, the card reads STALE (F-049 edge)', async () => {
    const { threadId, proposalId, layerId } = await seed();
    db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, active) VALUES (?, ?, 'x.flac', '{"engine":"yue2"}', 0)`).run(crypto.randomUUID(), layerId);
    const out = await applyEdit(threadId, proposalId, deps());
    expect(out).toEqual({ reason: STALE, stale: true });
    expect(getRunning()).toBeNull();
    expect(view(threadId)[0].state).toBe('stale');
  });

  it('a repaint queued in the Editor after the plan: refused as stale, naming it', async () => {
    const { threadId, proposalId, songId } = await seed();
    enqueue({ jobId: 'rp', kind: 'repaint', songId, label: 'repaint 1:32–2:07' }, () => new Promise(() => {}));
    const out = await applyEdit(threadId, proposalId, deps());
    expect(out).toEqual({ reason: `${STALE}: a repaint 1:32–2:07 was queued after this plan`, stale: true });
    releaseSlot('rp');
  });

  it('a planner still loaded refuses without making the card stale (D-053)', async () => {
    const { threadId, proposalId } = await seed();
    loaded = [{ name: 'qwen3:14b', contextLength: 16384 }];
    const out = await applyEdit(threadId, proposalId, deps());
    expect(out).toMatchObject({ reason: expect.stringContaining('qwen3:14b') });
    expect('stale' in out && out.stale).toBe(false);
    expect(view(threadId)[0].state).toBe('pending');
  });

  it('an expired, replaced or foreign proposal, or a second APPLY while one runs, starts nothing', async () => {
    const { threadId, proposalId } = await seed();
    expect(await applyEdit(threadId, 'nope', deps())).toEqual({ reason: 'this proposal expired: ask again' });
    const other = await seed();
    expect(await applyEdit(threadId, other.proposalId, deps())).toEqual({ reason: 'this proposal expired: ask again' });
    yue.job = { states: [{ status: 'running', stage: 'semantic' }] };
    const first = await applyEdit(threadId, proposalId, deps());
    expect('job' in first).toBe(true);
    expect(await applyEdit(threadId, proposalId, deps())).toEqual({ reason: 'APPLY is already running for this song' });
    yue.job = { states: [{ status: 'succeeded', stage: 'done' }] };
  });
});
