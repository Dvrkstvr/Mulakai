/** The `scoreRender` job (F-023 #2-#6) on the real genQueue, a temp DATA_DIR and fakeYue's job API. */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-scorerender-test-'));
process.env.POLL_INTERVAL_MS = '5';

vi.mock('../transcode.js', () => ({
  transcodeBuffer: async (master: Buffer, outPath: string) => { await (await import('node:fs/promises')).writeFile(outPath, master); },
  transcodeFile: async () => {},
  probeFfmpeg: async () => true,
}));

const { db } = await import('../../db/index.js');
const { config } = await import('../../config.js');
const { startFakeYue } = await import('../../../test-fakes/fakeYue.js');
const { enqueue, getRunning, releaseSlot, resetQueue } = await import('../genQueue.js');
const { abortJob, getJob } = await import('../jobRegistry.js');
const { writeScoreSidecar } = await import('../versionFiles.js');
const { getPlan, lastRender, resetPlans, setPlan } = await import('./planStore.js');
const { CHANGED_SINCE_PLAN } = await import('./scoreEligibility.js');
const { editQueued, plannerLoaded } = await import('./scoreLimits.js');
const { loadScoreSource } = await import('./scoreSource.js');
const { scoreStatus } = await import('./scoreStatus.js');
const { checkRender, renderDeps, startScoreRender } = await import('./scoreRenderJob.js');
type FakeYue = Awaited<ReturnType<typeof startFakeYue>>;
type LoadedModel = import('./ollamaControl.js').LoadedModel;
type RenderMode = import('./renderMode.js').RenderMode;

const LYRICS = '[Verse 1]\nwalking out \n\n[Chorus]\noh oh\n';
const BASE_ABC = 'X:1\nM:4/4\nL:1/8\nQ:1/4=87\nK:Dm\n"Dm"D2 F2 A2 d2 |\n';
const EDITED = 'X:1\nM:4/4\nL:1/8\nQ:1/4=88\nK:Dm\n"Dm7"D2 F2 A2 d2 |\n';
const STYLE = 'English, dark pop, 87 bpm';
const read = { ok: true, error: null, messages: [], chordsPresent: true, bpm: 87, seconds: 179, tokens: 1500, facts: null };

let yue: FakeYue;
let loaded: LoadedModel[] = [];
beforeAll(async () => { yue = await startFakeYue([]); });
afterAll(async () => { await yue.close(); });
afterEach(() => { resetQueue(); resetPlans(); loaded = []; yue.requests.length = 0; });

const deps = () => renderDeps({
  target: { label: 'YUE2', url: yue.url, apiKey: '' },
  status: (songId) => scoreStatus(songId, { plannerConfigured: true, yueConfigured: true, read: async () => read as never }),
  loaded: async () => loaded,
});

async function seed(renderMode: RenderMode = { cot: 'full', reason: 'chords' }) {
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title, lyrics, bpm, gen_task, engine) VALUES (?, 'Copper Sky', ?, 87, 'text2music', 'yue2')`).run(songId, LYRICS);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layerId, songId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, seed) VALUES (?, ?, ?, ?, '831')`).run(versionId, layerId, `${versionId}.flac`,
    JSON.stringify({ engine: 'yue2', task_type: 'text2music', lyrics: LYRICS, request: { style: STYLE, lyrics: LYRICS, seed: 831 } }));
  await writeScoreSidecar(versionId, BASE_ABC);
  const source = (await loadScoreSource(songId))!;
  setPlan({
    id: `plan-${songId}`, songId, baseVersionId: versionId, fingerprint: source.fingerprint, request: '88 BPM', ops: [{ op: 'SET_TEMPO', bpm: 88 }],
    verdicts: [], abc: EDITED, style: 'English, dark pop, 88 bpm', checks: { bars: 1, seconds: 3, tokens: 10, chordsPresent: true, changed: { abc: true, style: true } },
    attempts: 1, createdAt: 0, renderMode,
  });
  return { songId, layerId, versionId, planId: `plan-${songId}` };
}

const versions = (layerId: string) => db.prepare(`SELECT id, label, active FROM versions WHERE layer_id = ? ORDER BY rowid`).all(layerId) as
  Array<{ id: string; label: string; active: number }>;
const settled = async (id: string) => {
  await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(id)?.status), { timeout: 5000 });
  await vi.waitFor(() => expect(getRunning()).toBeNull(), { timeout: 5000 });
};

describe('startScoreRender', () => {
  it("sends the plan's render mode: a chord-free plan renders with cot melody (F-065, D-132)", async () => {
    const { songId, planId } = await seed({ cot: 'melody', reason: 'melody' });
    yue.job = { states: [{ status: 'succeeded', stage: 'done' }], score: EDITED };
    await settled(startScoreRender(songId, planId, deps()).id);
    expect(yue.submits()).toMatchObject([{ cot: 'melody', abc: EDITED }]);
  });

  it('renders the edited score and saves it as the active base version; the plan is used up', async () => {
    const { songId, layerId, versionId, planId } = await seed();
    yue.job = { states: [{ status: 'running', stage: 'semantic', progress: 0.2 }, { status: 'succeeded', stage: 'done' }], score: EDITED };
    const job = startScoreRender(songId, planId, deps());
    await settled(job.id);
    expect(getJob(job.id)).toMatchObject({ status: 'done' });
    expect(yue.submits()).toEqual([{ abc: EDITED, cot: 'full', style: 'English, dark pop, 88 bpm', lyrics: LYRICS, seed: 831 }]);
    const [old, fresh] = versions(layerId);
    expect(old).toMatchObject({ id: versionId, active: 0 });
    expect(fresh).toMatchObject({ active: 1, label: 'score edit · SET TEMPO 88' });
    expect(lastRender(songId)?.version).toMatchObject({ id: fresh.id, number: 2, bpm: 88, truncated: false });
    expect(fs.readFileSync(path.join(config.audioDir, `${fresh.id}.abc`), 'utf8')).toBe(EDITED);
    expect(getPlan(songId)).toBeUndefined();
  });

  it("sends the plan's edited lyrics, not the stored ones, and the new version keeps them (F-030, F-031)", async () => {
    const { songId, layerId, planId } = await seed();
    const edited = `${LYRICS}\n[Chorus]\noh oh\n`;
    setPlan({ ...getPlan(songId)!, lyrics: edited });
    yue.job = { states: [{ status: 'succeeded', stage: 'done' }], score: EDITED };
    await settled(startScoreRender(songId, planId, deps()).id);
    expect(yue.submits()).toEqual([expect.objectContaining({ lyrics: edited })]);
    const fresh = db.prepare(`SELECT params_json FROM versions WHERE layer_id = ? AND active = 1`).get(layerId) as { params_json: string };
    expect(JSON.parse(fresh.params_json)).toMatchObject({ request: { lyrics: edited }, lyrics: edited });
  });

  it('a truncated result is saved and marked, not done-as-usual (F-023 #4)', async () => {
    const { songId, layerId, planId } = await seed();
    yue.job = { states: [{ status: 'truncated', stage: 'done' }], score: EDITED };
    const job = startScoreRender(songId, planId, deps());
    await settled(job.id);
    expect(lastRender(songId)?.version?.truncated).toBe(true);
    expect(versions(layerId)[1]).toMatchObject({ active: 1, label: 'score edit · SET TEMPO 88 (truncated)' });
  });

  it('a yue-server error saves nothing, leaves the base active and keeps the plan (F-023 #5)', async () => {
    const { songId, layerId, versionId, planId } = await seed();
    yue.job = { states: [{ status: 'running', stage: 'semantic' }, { status: 'failed', error: { code: 'internal', message: 'CUDA out of memory' } }] };
    const job = startScoreRender(songId, planId, deps());
    await settled(job.id);
    expect(getJob(job.id)).toMatchObject({ status: 'failed', error: 'CUDA out of memory' });
    expect(versions(layerId)).toEqual([expect.objectContaining({ id: versionId, active: 1 })]);
    expect(getPlan(songId)?.id).toBe(planId);
    expect(lastRender(songId)).toMatchObject({ version: null, refused: null });
  });

  it('CANCEL while rendering aborts, drains YuE2 before the slot frees, and saves no version (F-023 #6)', async () => {
    const { songId, layerId, planId } = await seed();
    yue.job = { states: [{ status: 'running', stage: 'synthesis', progress: 0.4 }] };
    const job = startScoreRender(songId, planId, deps());
    await vi.waitFor(() => expect(getJob(job.id)?.progressStage).toBe('synthesis'));
    expect(abortJob(job.id)).toBe(true);
    expect(getJob(job.id)).toMatchObject({ status: 'failed', error: 'Aborted' });
    expect(getRunning()?.draining).toBe(true);
    await settled(job.id);
    expect(yue.requests.some((r) => r.path.endsWith('/cancel'))).toBe(true);
    expect(versions(layerId)).toHaveLength(1);
    expect(getPlan(songId)?.id).toBe(planId);
  });

  it('re-checks when its turn comes: a song changed while it waited is refused with no engine job', async () => {
    const { songId, layerId, planId } = await seed();
    enqueue({ kind: 'repaint', jobId: 'hold', songId }, () => new Promise(() => {}));
    const job = startScoreRender(songId, planId, deps());
    db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, active) VALUES (?, ?, 'x.flac', '{"engine":"yue2"}', 0)`).run(crypto.randomUUID(), layerId);
    releaseSlot('hold');
    await settled(job.id);
    expect(getJob(job.id)).toMatchObject({ status: 'failed', error: CHANGED_SINCE_PLAN });
    expect(lastRender(songId)?.refused).toBe(CHANGED_SINCE_PLAN);
    expect(yue.submits()).toEqual([]);
  });

  it('refuses at its turn while /api/ps still lists the planner, with no engine job', async () => {
    const { songId, planId } = await seed();
    loaded = [{ name: 'qwen3:14b', contextLength: 16384 }];
    const job = startScoreRender(songId, planId, deps());
    await settled(job.id);
    expect(getJob(job.id)?.error).toBe(plannerLoaded(['qwen3:14b']));
    expect(yue.submits()).toEqual([]);
  });
});

describe('checkRender at the click: only an edit stales a plan (Q-038 #4, D-173)', () => {
  const hold = () => new Promise<void>(() => {});
  it('a running timings job and queued chat analysis, transcribe, lyrics, analyze and lm jobs leave APPLY clean', async () => {
    const { songId, planId } = await seed();
    enqueue({ kind: 'timings', jobId: 'r-timings', songId, label: 'word timings' }, hold);
    enqueue({ kind: 'transcribe', jobId: 'q-analysis', songId, label: 'chat analysis' }, hold);
    enqueue({ kind: 'transcribe', jobId: 'q-read', songId, label: 'read the melody' }, hold);
    enqueue({ kind: 'lyrics', jobId: 'q-lyrics', songId }, hold);
    enqueue({ kind: 'analyze', jobId: 'q-analyze', songId }, hold);
    enqueue({ kind: 'lm', jobId: 'q-lm', songId }, hold);
    expect(await checkRender(songId, planId, deps(), true)).toMatchObject({ plan: { id: planId } });
  });

  it.each([
    ['repaint', 'repaint 1:32–2:07'], ['regenerate', undefined], ['retake', undefined], ['addLayer', 'add a layer'], ['split', undefined],
  ] as const)('a queued %s still refuses, stale, by what it does', async (kind, label) => {
    const { songId, planId } = await seed();
    enqueue({ kind: 'timings', jobId: 'r-timings', songId }, hold);
    enqueue({ kind, jobId: `q-${kind}`, songId, label }, hold);
    expect(await checkRender(songId, planId, deps(), true)).toEqual({ refusal: editQueued(label ?? kind), stale: true });
  });

  it('an edit on another song does not refuse', async () => {
    const { songId, planId } = await seed();
    enqueue({ kind: 'repaint', jobId: 'r-other', songId: 'other-song' }, hold);
    expect(await checkRender(songId, planId, deps(), true)).toMatchObject({ plan: { id: planId } });
  });
});
