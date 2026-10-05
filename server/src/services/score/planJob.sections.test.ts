/** REPEAT / CUT / REWRITE_LYRICS / TRANSPOSE through the `plan` job (F-029..F-031): fakeOllama replays
 * plans whose ops are the recorded yue-server fixtures, so the lyrics sent, the edited lyrics kept, the
 * notes, diffs and the cut hint are what yue-server really answers. */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-plansections-test-'));

const { startFakeOllama } = await import('../../../test-fakes/fakeOllama.js');
const { contract, startFakeYue } = await import('../../../test-fakes/fakeYue.js');
const { resetQueue } = await import('../genQueue.js');
const { getJob } = await import('../jobRegistry.js');
const { startPlan, planDeps, CHECK_FAILED } = await import('./planJob.js');
const { getPlan, resetPlans } = await import('./planStore.js');
const { applyOps } = await import('./yueScoreApply.js');
type FakeOllama = Awaited<ReturnType<typeof startFakeOllama>>;
type FakeYue = Awaited<ReturnType<typeof startFakeYue>>;
type ScoreStatus = import('./scoreStatus.js').ScoreStatus;

const read = contract('read-sections');
const base = contract('apply-repeat').request.body as { abc: string; style: string; lyrics: string };
const SONG = 'song-sections';
const status = (): ScoreStatus => ({
  eligibility: { state: 'eligible' },
  source: { songId: SONG, activeVersionId: 'v1', abc: base.abc, style: base.style, lyrics: base.lyrics, fingerprint: 'l1|v1|v1' } as ScoreStatus['source'],
  read: { ok: true, error: null, messages: [], chordsPresent: true, bpm: 87, seconds: 179.3, tokens: 1832, facts: read.response.body.facts as never },
});
const planOf = (fixture: string) => ({ content: JSON.stringify({ ops: contract(fixture).request.body.ops }) });

let ollama: FakeOllama;
let yue: FakeYue;
beforeAll(async () => { yue = await startFakeYue(); });
afterAll(async () => { await yue.close(); });
afterEach(async () => { await ollama?.close(); resetQueue(); resetPlans(); yue.requests.length = 0; });

const deps = () => planDeps({
  planner: { url: ollama.url, model: 'qwen3:14b' }, status: async () => status(),
  apply: (b, ops) => applyOps(b, ops, { label: 'YUE2', url: yue.url, apiKey: '' }),
});
const settled = async (id: string) => {
  await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(id)?.status), { timeout: 5000 });
  return getJob(id)!;
};
type Chat = { messages: Array<{ role: string; content: string }>; response_format: { json_schema: { schema: any } } };
const chats = () => ollama.requests.filter((r) => r.path === '/v1/chat/completions').map((r) => r.body as Chat);
const applies = () => yue.requests.filter((r) => r.path === '/v1/scores/apply').map((r) => r.body as Record<string, unknown>);

describe('section and lyric ops through the plan job (F-030, F-031)', () => {
  it('sends the stored lyrics, keeps the edited ones and the lyric diff on the plan (F-031 #1, #2)', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(planOf('apply-rewrite-lyrics'));
    expect((await settled(startPlan(SONG, 'rewrite the second chorus about paper boats', deps()).id)).status).toBe('done');
    const [ask] = chats();
    expect(ask.messages[1].content).toContain('5: [Chorus] #2, 4 lines, first line: chorus 5 line 1');
    const rewrite = ask.response_format.json_schema.schema.properties.ops.items.anyOf.find((o: any) => o.properties.op.const === 'REWRITE_LYRICS');
    expect(rewrite.properties.block).toEqual({ type: 'integer', minimum: 1, maximum: 7 });
    expect(applies()[0].lyrics).toBe(base.lyrics);
    const plan = getPlan(SONG)!;
    expect(plan.lyrics).toBe(contract('apply-rewrite-lyrics').response.body.lyrics);
    expect(plan.checks.changed).toEqual({ abc: false, style: false, lyrics: true }); // a lyrics-only plan is a change
    expect(plan.verdicts[0].diff).toEqual({ block: 5, tag: '[Chorus]', occurrence: 2,
      old: ['chorus 5 line 1', 'chorus 5 line 2', 'chorus 5 line 3', 'chorus 5 line 4'],
      new: ['paper boats', 'on a silver tide', 'we never sank', 'we only drifted'] });
  });

  it("carries a REPEAT's lyric note, the unmatched-block rule, to the plan (F-030 #3)", async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(planOf('apply-repeat'));
    expect((await settled(startPlan(SONG, 'repeat the chorus', deps()).id)).status).toBe('done');
    const plan = getPlan(SONG)!;
    expect(plan.verdicts[0].note).toBe('lyric block 3 [Chorus] is repeated with it; block 5 [Chorus] matches no chorus in the score and stays as it is');
    expect(plan.lyrics).toContain('chorus 3 line 4\n\n[Chorus]\nchorus 3 line 1'); // block 3 copied after itself
  });

  it('names the section to cut when a repeat passes 360 s, by its read number, to the planner and the review (F-030 #2)', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(planOf('apply-repeat-over-limit'));
    const job = await settled(startPlan(SONG, 'repeat the verse, 66 BPM', deps()).id);
    const line = 'estimated 367 s: over the 360 s limit; cut the outro 0:11 to fit (section 4), or at least 68 BPM fits';
    expect(job.error).toBe(`${CHECK_FAILED}: ${line}`);
    expect(chats()[1].messages.at(-1)!.content).toContain(`- ${line}`);
    expect(getPlan(SONG)).toBeUndefined();
  });
});
