/** F-066 #4: an audio-only REPEAT saves its edited (longer) score as the new version's sidecar (spliceRenderJob
 * saves `plan.abc`), so a later whole-song plan reads and applies that score, and the 360 s limit judges the
 * extended length: the verifier's case, REPEAT bridge 354.2 s, then SET_TEMPO 140 on it 366.9 s, refused with
 * the existing line; the same tempo on the score before the REPEAT (353.1 s) passes. Fakes: fakeOllama, a stub apply. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-planafterrepeat-test-'));

const { startFakeOllama } = await import('../../../test-fakes/fakeOllama.js');
const { contract } = await import('../../../test-fakes/fakeYue.js');
const { resetQueue } = await import('../genQueue.js');
const { getJob } = await import('../jobRegistry.js');
const { startPlan, planDeps, CHECK_FAILED } = await import('./planJob.js');
const { getPlan, resetPlans } = await import('./planStore.js');
type FakeOllama = Awaited<ReturnType<typeof startFakeOllama>>;
type ScoreStatus = import('./scoreStatus.js').ScoreStatus;
type ApplyResult = import('./planTypes.js').ApplyResult;
type ApplyBase = import('./yueScoreApply.js').ApplyBase;

const read = contract('read-sections');
const before = contract('apply-repeat').request.body as { abc: string; style: string; lyrics: string };
/** The REPEAT's edited score: what the audio-only REPEAT saved as v2's sidecar. */
const repeated = contract('apply-repeat').response.body as { abc: string };
const SONG = 'song-after-repeat';
const TEMPO = JSON.stringify({ ops: [{ op: 'SET_TEMPO', bpm: 140 }] });

const status = (abc: string): ScoreStatus => ({
  eligibility: { state: 'eligible' },
  source: { songId: SONG, activeVersionId: 'v2', abc, style: before.style, lyrics: before.lyrics, fingerprint: 'l1|v2|v2' } as ScoreStatus['source'],
  read: { ok: true, error: null, messages: [], chordsPresent: true, bpm: 128, seconds: 354.2, tokens: 1832, facts: read.response.body.facts as never },
});
/** yue-server's apply, stubbed to the verifier's measured lengths for SET_TEMPO 140 on each score. */
const sent: string[] = [];
const apply = async (base: ApplyBase): Promise<ApplyResult> => {
  sent.push(base.abc);
  return {
    ok: true, abc: `${base.abc}\n%140`, style: before.style, verdicts: [{ index: 1, op: 'SET_TEMPO', ok: true, reason: null }],
    checks: { ok: true, problems: [], differences: [] }, changed: { abc: true, style: false },
    chords_present: true, bpm: 140, seconds: base.abc === repeated.abc ? 366.9 : 353.1, tokens: 1900,
  };
};

let ollama: FakeOllama;
afterEach(async () => { await ollama?.close(); resetQueue(); resetPlans(); sent.length = 0; });
const deps = (abc: string) => planDeps({ planner: { url: ollama.url, model: 'qwen3:14b' }, status: async () => status(abc), apply });
const settled = async (id: string) => {
  await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(id)?.status), { timeout: 5000 });
  return getJob(id)!;
};

describe('a whole-song re-render after an audio-only REPEAT (F-066 #4)', () => {
  it('applies to the extended score and refuses 367 s with the existing limit line', async () => {
    expect(repeated.abc).not.toBe(before.abc);
    ollama = await startFakeOllama();
    ollama.chats.push({ content: TEMPO }, { content: TEMPO }, { content: TEMPO });
    const job = await settled(startPlan(SONG, 'make it 140 BPM', deps(repeated.abc)).id);
    expect(sent.every((abc) => abc === repeated.abc)).toBe(true);
    expect(job.status).toBe('failed');
    expect(job.error).toBe(`${CHECK_FAILED}: estimated 367 s: over the 360 s limit; at least 143 BPM fits`);
    expect(getPlan(SONG)).toBeUndefined();
  });

  it('passes the same tempo change on the score before the REPEAT (353 s)', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push({ content: TEMPO });
    const job = await settled(startPlan(SONG, 'make it 140 BPM', deps(before.abc)).id);
    expect(job.status).toBe('done');
    expect(getPlan(SONG)?.checks.seconds).toBeCloseTo(353.1);
  });
});
