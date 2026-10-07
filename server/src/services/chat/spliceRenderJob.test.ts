/** The chat's APPLY job (F-047, F-049 #1, D-101, D-154) on the real genQueue, a temp DATA_DIR and fakeYue: the
 * YuE2 render (jobs API) and CB-1's recorded splices. One `scoreRender` slot, label `chat edit`. */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-splicerender-test-'));
process.env.POLL_INTERVAL_MS = '5';

vi.mock('../transcode.js', () => ({
  transcodeBuffer: async (master: Buffer, outPath: string) => { await (await import('node:fs/promises')).writeFile(outPath, master); },
  transcodeFile: async () => {},
  probeFfmpeg: async () => true,
}));

const { db } = await import('../../db/index.js');
const { config } = await import('../../config.js');
const { spliceContract, startFakeYue } = await import('../../../test-fakes/fakeYue.js');
const { getRunning, resetQueue } = await import('../genQueue.js');
const { abortJob, getJob } = await import('../jobRegistry.js');
const { writeScoreSidecar } = await import('../versionFiles.js');
const { getPlan, resetPlans, setPlan } = await import('../score/planStore.js');
const { loadScoreSource } = await import('../score/scoreSource.js');
const { scoreStatus } = await import('../score/scoreStatus.js');
const { renderDeps } = await import('../score/scoreRenderJob.js');
const { readGrid, writeGrid } = await import('./gridCache.js');
const { startEditRender } = await import('./spliceRenderJob.js');
type FakeYue = Awaited<ReturnType<typeof startFakeYue>>;
type Op = import('../score/planTypes.js').Op;
type Splice = import('./spliceEligibility.js').Splice;
type Saved = Parameters<Parameters<typeof startEditRender>[3]>[0];

const OK = spliceContract('splice-ok');
const BASE_ABC = OK.request.form.spec.base_abc as string;
const REHARM = OK.request.form.spec.op as Op;
const REPEAT = spliceContract('splice-rerender').request.form.spec.op as Op;
const GRID = spliceContract('splice-rerender').request.form.spec.base_grid as Record<string, unknown>;
const EDITED = BASE_ABC.replace('"C"z32|"Am"z32|"F"z32|"G"z32|\nV: Ins\nz32|z32|z32|z32|\n% verse', '"Cmaj7"z32|"Am"z32|"F"z32|"G"z32|\nV: Ins\nz32|z32|z32|z32|\n% verse');
const read = { ok: true, error: null, messages: [], chordsPresent: true, bpm: 120, seconds: 48, tokens: 900, facts: null };
const SPLICE_REHARM: Splice = { splice: true, kind: 'reharmonize', from_bar: 9, to_bar: 16 };
const SPLICE_REPEAT: Splice = { splice: true, kind: 'repeat', from_bar: 9, to_bar: 16 };

let yue: FakeYue;
beforeAll(async () => { yue = await startFakeYue([]); });
afterAll(async () => { await yue.close(); });
afterEach(() => {
  resetQueue(); resetPlans(); yue.requests.length = 0;
  yue.splice = { fixture: spliceContract('splice-ok'), specs: [], cancelled: new Set() };
  yue.job = { states: [{ status: 'succeeded', stage: 'done' }] };
});

const deps = () => renderDeps({
  target: { label: 'YUE2', url: yue.url, apiKey: '' },
  status: (songId) => scoreStatus(songId, { plannerConfigured: true, yueConfigured: true, read: async () => read as never }),
  loaded: async () => [],
});

async function seed(op: Op) {
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
    id: planId, songId, baseVersionId: versionId, fingerprint: source.fingerprint, request: 'jazz chords', ops: [op], verdicts: [], abc: EDITED, style: 'pop',
    checks: { bars: 24, seconds: 48, tokens: 900, chordsPresent: true, changed: { abc: true, style: false } }, attempts: 1, refusals: [], createdAt: 0,
    renderMode: { cot: 'full', reason: 'chords' },
  });
  return { songId, layerId, versionId, planId };
}

const rows = (layerId: string) => db.prepare(`SELECT id, label, active, params_json FROM versions WHERE layer_id = ? ORDER BY rowid`).all(layerId) as
  Array<{ id: string; label: string; active: number; params_json: string }>;
const settled = async (id: string) => {
  await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(id)?.status), { timeout: 5000 });
  await vi.waitFor(() => expect(getRunning()).toBeNull(), { timeout: 5000 });
  return getJob(id)!;
};
const posted = (p: string) => yue.requests.filter((r) => r.method === 'POST' && r.path === p).length;

function start(songId: string, planId: string, splice: Splice) {
  const saved: Saved[] = [];
  const job = startEditRender(songId, planId, splice, (s) => { saved.push(s); }, deps());
  return { job, saved };
}

describe('startEditRender', () => {
  it('REHARMONIZE: renders, splices the span into the base, saves it with the splice record and caches the grids (F-047 #1, #3)', async () => {
    const { songId, layerId, versionId, planId } = await seed(REHARM);
    yue.job = { states: [{ status: 'running', stage: 'semantic' }, { status: 'succeeded', stage: 'done' }], score: EDITED };
    yue.splice.grids = { base: GRID, out: { ...GRID, source: 'mapped' } };
    const { job, saved } = start(songId, planId, SPLICE_REHARM);
    expect(getRunning()).toMatchObject({ kind: 'scoreRender', label: 'chat edit', songId });
    expect((await settled(job.id)).status).toBe('done');
    expect(yue.splice.specs).toEqual([{ op: REHARM, base_abc: BASE_ABC, render_job: 'yue-1', edited_abc: EDITED }]);
    const [, fresh] = rows(layerId);
    expect(fresh).toMatchObject({ active: 1, label: 'score edit · REHARMONIZE 9–16 · bars 9–16 spliced' });
    expect(JSON.parse(fresh.params_json).splice).toEqual({
      splice_v: 1, kind: 'reharmonize', bars: [9, 16], joins_s: [16.2, 32.2], crossfade_s: [0.5, 0.5],
      gain_db: { in: 0, out: 0, bars: [0, 0, 0, 0, 0, 0, 0, 0] }, snap_ms: [30, 30], length_diff_s: 0, null_test: { samples: 1570000, different: 0 },
    });
    expect(fs.readFileSync(path.join(config.audioDir, `${fresh.id}.flac`), 'utf8')).toBe('RIFF-spliced-float32');
    expect(fs.readFileSync(path.join(config.audioDir, `${fresh.id}.abc`), 'utf8')).toBe(EDITED);
    expect(await readGrid(versionId)).toEqual(GRID);
    expect(await readGrid(fresh.id)).toMatchObject({ source: 'mapped' });
    expect(saved).toMatchObject([{ version: { id: fresh.id, number: 2 }, splice: { kind: 'reharmonize' }, previous: { versionId, number: 1 } }]);
    expect(getPlan(songId)).toBeUndefined();
    expect(posted('/v1/splices/sp-0001/cancel')).toBe(1); // every exit ends the yue splice job and its temp files
  });

  it('a cached base grid rides along; REPEAT splices with no render; a rerender verdict renders the whole song and labels it (D-154, D-101)', async () => {
    const { songId, layerId, versionId, planId } = await seed(REPEAT);
    await writeGrid(versionId, GRID);
    yue.splice.fixture = spliceContract('splice-rerender');
    const { job, saved } = start(songId, planId, SPLICE_REPEAT);
    expect((await settled(job.id)).status).toBe('done');
    expect(yue.splice.specs).toEqual([{ op: REPEAT, base_abc: BASE_ABC, edited_abc: EDITED, base_grid: GRID }]);
    expect(yue.submits()).toHaveLength(1); // the whole song, rendered only once the splice said no
    const fresh = rows(layerId)[1];
    expect(fresh.label).toMatch(/^score edit · REPEAT chorus S2 · whole song re-rendered: the copy's seam steps \+10\.4 dB/);
    expect(JSON.parse(fresh.params_json).splice).toMatchObject({ splice_v: 1, fallback: expect.stringContaining('+10.4 dB') });
    expect(saved[0].splice).toMatchObject({ fallback: expect.stringContaining('+10.4 dB') });
  });

  it('a splice yue-server refuses (422) saves the render it already made, labelled (D-101)', async () => {
    const { songId, layerId, planId } = await seed(REHARM);
    yue.splice.submit = { status: 422, detail: 'bars 9-16 are not inside the score' };
    const { job } = start(songId, planId, SPLICE_REHARM);
    expect((await settled(job.id)).status).toBe('done');
    expect(yue.submits()).toHaveLength(1);
    expect(rows(layerId)[1].label).toContain('whole song re-rendered: yue-server would not splice it: YUE2 splice -> HTTP 422: bars 9-16 are not inside the score');
  });

  it('a whole-song edit renders and saves, with no splice step (F-046 #2)', async () => {
    const { songId, layerId, planId } = await seed({ op: 'SET_TEMPO', bpm: 96 });
    const { job, saved } = start(songId, planId, { splice: false, reason: 'SET TEMPO changes the whole take' });
    expect((await settled(job.id)).status).toBe('done');
    expect(yue.splice.specs).toEqual([]);
    expect(rows(layerId)[1].label).toBe('score edit · SET TEMPO 96');
    expect(saved[0]).toMatchObject({ splice: undefined });
  });

  it('a failed splice saves nothing: the job fails with the reason and the yue job is ended (F-047 edge)', async () => {
    const { songId, layerId, planId } = await seed(REHARM);
    yue.splice.fixture = spliceContract('splice-failed');
    const { job, saved } = start(songId, planId, SPLICE_REHARM);
    expect(await settled(job.id)).toMatchObject({ status: 'failed', error: 'the splice failed: render job job-0001 has no audio on this server' });
    expect(rows(layerId)).toHaveLength(1);
    expect(saved).toEqual([]);
    expect(getPlan(songId)).toBeDefined(); // the card returns to pending: APPLY again
  });

  it('CANCEL while splicing ends the yue job, saves no version and keeps the plan (F-049 #1)', async () => {
    const { songId, layerId, planId } = await seed(REHARM);
    yue.splice.fixture = spliceContract('splice-hold');
    const { job } = start(songId, planId, SPLICE_REHARM);
    await vi.waitFor(() => expect(job.progressText).toBe('splicing'), { timeout: 5000 });
    expect(abortJob(job.id)).toBe(true);
    expect((await settled(job.id)).status).toBe('failed');
    expect(posted('/v1/splices/sp-0001/cancel')).toBeGreaterThanOrEqual(1);
    expect(rows(layerId)).toHaveLength(1);
    expect(getPlan(songId)).toBeDefined();
  });

  it('a CANCEL that lands while saving keeps the version: the job is not read as cancelled (nothing-saved)', async () => {
    const { songId, layerId, planId } = await seed(REHARM);
    yue.job = { states: [{ status: 'succeeded', stage: 'done' }], score: EDITED };
    const job = startEditRender(songId, planId, SPLICE_REHARM, () => { abortJob(job.id); job.cancelled = true; }, deps());
    const out = await settled(job.id);
    expect(out).toMatchObject({ status: 'failed', error: expect.stringContaining('already finished') });
    expect(out.cancelled).toBeFalsy();
    expect(rows(layerId)).toHaveLength(2);
  });

  it('CANCEL while rendering is the existing ABORT: no splice is sent, no version (F-049 #1)', async () => {
    const { songId, layerId, planId } = await seed(REHARM);
    yue.job = { states: [{ status: 'running', stage: 'semantic' }] };
    const { job } = start(songId, planId, SPLICE_REHARM);
    await vi.waitFor(() => expect(job.status).toBe('running'), { timeout: 5000 });
    expect(job.progressText).toBe('rendering');
    abortJob(job.id);
    expect((await settled(job.id)).status).toBe('failed');
    expect(yue.splice.specs).toEqual([]);
    expect(rows(layerId)).toHaveLength(1);
  });

  it('the song changed before its turn: refused, no engine job (F-049 edge)', async () => {
    const { songId, layerId, planId } = await seed(REHARM);
    db.prepare(`UPDATE versions SET active = 0 WHERE layer_id = ?`).run(layerId);
    const { job } = start(songId, planId, SPLICE_REHARM);
    expect((await settled(job.id)).status).toBe('failed');
    expect(yue.submits()).toEqual([]);
    expect(yue.splice.specs).toEqual([]);
  });
});
