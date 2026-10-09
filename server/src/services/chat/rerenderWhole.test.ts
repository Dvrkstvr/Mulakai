/** RE-RENDER WHOLE SONG (F-066 #5, D-268): a no-op plan on the active spliced version becomes a pending whole-song edit
 * card, with no model call; APPLY of that card takes the existing whole-song path. Temp DATA_DIR, fakeYue. */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-rerender-test-'));
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
const { getJob, registerJob } = await import('../jobRegistry.js');
const { writeScoreSidecar } = await import('../versionFiles.js');
const { getPlan, resetPlans } = await import('../score/planStore.js');
const { scoreStatus } = await import('../score/scoreStatus.js');
const { renderDeps } = await import('../score/scoreRenderJob.js');
const { appendMessage, listMessages } = await import('./messageStore.js');
const { proposalLife, resetProposals } = await import('./proposalStore.js');
const { songThread } = await import('./threadStore.js');
const { applyEdit, editCommitDeps } = await import('./editCommit.js');
const { rerenderWhole, WHOLE_REASON, APPLY_RUNNING } = await import('./rerenderWhole.js');
type EditBody = import('./chatTypes.js').EditBody;

const BASE_ABC = spliceContract('splice-ok').request.form.spec.base_abc as string;
const facts = {
  header: { meter: '4/4', unit: '1/8', bpm: 120, key: 'C', bars: 24, seconds: 48, units_per_quarter: 2 },
  key_notes: '', sections: [{ index: 1, label: 'Verse', from_bar: 1, to_bar: 24 }], lyric_blocks: [], bar_map: [],
};
let read: Record<string, unknown> = {};
const status = (songId: string) => scoreStatus(songId, { plannerConfigured: true, yueConfigured: true, read: async () => read as never });

let yue: Awaited<ReturnType<typeof startFakeYue>>;
beforeAll(async () => { yue = await startFakeYue([]); });
afterAll(async () => { await yue.close(); });
afterEach(() => { resetQueue(); resetPlans(); resetProposals(); });

const SPLICED = { splice_v: 1, kind: 'cut', bars: [9, 16], joins_s: [16], crossfade_s: 0.5, gain_db: 0, snap_ms: [0], length_diff_s: 0, null_test: { differing: 0 } };

/** A song whose base layer holds v1 and the spliced v2 (active), with v2's version card in the song's thread. */
async function seed(splice: unknown = SPLICED, { activeIsV2 = true } = {}) {
  read = { ok: true, error: null, messages: [], chordsPresent: true, bpm: 120, seconds: 48, tokens: 900, facts };
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const [v1, v2] = [crypto.randomUUID(), crypto.randomUUID()];
  db.prepare(`INSERT INTO songs (id, title, lyrics, bpm, gen_task, engine) VALUES (?, 'Luz', '[verse]\nla', 120, 'text2music', 'yue2')`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layerId, songId);
  const request = { style: 'pop', lyrics: '[verse]\nla', seed: 7 };
  const insert = db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, seed, active, created_at) VALUES (?, ?, ?, ?, '7', ?, ?)`);
  insert.run(v1, layerId, `${v1}.flac`, JSON.stringify({ engine: 'yue2', task_type: 'text2music', request }), activeIsV2 ? 0 : 1, '2026-10-01 10:00:00');
  insert.run(v2, layerId, `${v2}.flac`, JSON.stringify({ engine: 'yue2', task_type: 'text2music', request, score_v: 1, ...(splice ? { splice } : {}) }), activeIsV2 ? 1 : 0, '2026-10-01 11:00:00');
  for (const v of [v1, v2]) {
    fs.writeFileSync(path.join(config.audioDir, `${v}.flac`), 'fLaC');
    await writeScoreSidecar(v, BASE_ABC);
  }
  const thread = songThread(songId);
  appendMessage(thread.id, {
    role: 'assistant', kind: 'version', text: 'Saved as v2', versionId: v2,
    body: { number: 2, seconds: 48, label: 'score edit · CUT Verse S2', truncated: false, whole: false, splice: null, fallback: null, previous: { versionId: v1, number: 1 } } as never,
  });
  return { songId, threadId: thread.id, v1, v2 };
}

describe('rerenderWhole', () => {
  it('appends a pending whole-song edit card over a no-op plan on the version\'s own score (D-268)', async () => {
    const { songId, threadId, v2 } = await seed();
    const out = await rerenderWhole(threadId, v2, { status });
    if ('reason' in out) throw new Error(out.reason);
    const card = listMessages(threadId).find((m) => m.id === out.messageId)!;
    expect(card).toMatchObject({ role: 'assistant', kind: 'edit', proposalId: out.proposalId, jobId: null });
    expect(card.text).toContain('v2');
    const body = card.body as EditBody;
    expect(body).toMatchObject({ ops: [], verdicts: [], splice: { splice: false, reason: WHOLE_REASON }, renderMode: { cot: 'full' }, from: { bpm: 120, key: 'C' } });
    expect(body.map).toBeUndefined(); // the strip's full hatch: every bar changes
    const plan = getPlan(songId)!;
    expect(plan).toMatchObject({ id: body.planId, baseVersionId: v2, ops: [], abc: BASE_ABC, style: 'pop', checks: { bars: 24, seconds: 48 } });
    expect(proposalLife(out.proposalId)).toBe('live');
  });

  it('APPLY of that card renders the whole song and saves v3 as the whole render', async () => {
    const { threadId, v2 } = await seed();
    const out = await rerenderWhole(threadId, v2, { status });
    if ('reason' in out) throw new Error(out.reason);
    const deps = editCommitDeps({ render: renderDeps({ target: { label: 'YUE2', url: yue.url, apiKey: '' }, status, loaded: async () => [] }) });
    const applied = await applyEdit(threadId, out.proposalId, deps);
    if (!('job' in applied)) throw new Error(applied.reason);
    await vi.waitFor(() => expect(getJob(applied.job.id)?.status).toBe('done'), { timeout: 5000 });
    await vi.waitFor(() => expect(getRunning()).toBeNull(), { timeout: 5000 });
    expect(yue.splice.specs).toEqual([]);
    expect(listMessages(threadId).at(-1)).toMatchObject({ kind: 'version', body: { number: 3, whole: true, splice: null, fallback: null } });
  });

  it('refuses a version that is not the active one', async () => {
    const { threadId, v2 } = await seed(SPLICED, { activeIsV2: false });
    expect(await rerenderWhole(threadId, v2, { status })).toEqual({ reason: 'v2 is not the active version: only the active version can be re-rendered whole' });
  });

  it('refuses a version saved as the whole render (a fallback) and one never spliced', async () => {
    for (const splice of [{ splice_v: 1, fallback: 'the join could not be aligned' }, null]) {
      const { threadId, v2 } = await seed(splice);
      expect(await rerenderWhole(threadId, v2, { status })).toEqual({ reason: 'v2 is already a whole-song render: there is no splice to re-render' });
    }
  });

  it('refuses while an APPLY of this chat runs, and a version with no card in this chat', async () => {
    const { threadId, v1, v2 } = await seed();
    expect(await rerenderWhole(threadId, v1, { status })).toMatchObject({ missing: true });
    const job = { id: crypto.randomUUID(), taskId: '', status: 'running' as const, createdAt: Date.now() };
    registerJob(job);
    appendMessage(threadId, { role: 'assistant', kind: 'edit', text: 'Jazz chords', body: null, jobId: job.id });
    expect(await rerenderWhole(threadId, v2, { status })).toEqual({ reason: APPLY_RUNNING });
    job.status = 'done' as never;
    expect(await rerenderWhole(threadId, v2, { status })).toHaveProperty('messageId');
  });

  it('a score over 360 s refuses with the existing limit line (F-066 #4)', async () => {
    const { threadId, v2 } = await seed();
    read = { ...read, seconds: 372 };
    const out = await rerenderWhole(threadId, v2, { status });
    expect(out).toMatchObject({ reason: expect.stringMatching(/^estimated 372 s: over the 360 s limit/) });
    expect(listMessages(threadId).filter((m) => m.kind === 'edit')).toEqual([]);
  });
});
