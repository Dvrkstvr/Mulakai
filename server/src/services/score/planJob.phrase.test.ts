/** WRITE PHRASE through the `plan` job (F-026): fakeOllama replays phrase plans whose ops are the
 * recorded yue-server fixtures, so every refusal the planner hears is the one yue-server sends. */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-planphrase-test-'));

const { phrasePlan, startFakeOllama } = await import('../../../test-fakes/fakeOllama.js');
const { contract, startFakeYue } = await import('../../../test-fakes/fakeYue.js');
const { resetQueue } = await import('../genQueue.js');
const { getJob } = await import('../jobRegistry.js');
const { startPlan, planDeps, CHECK_FAILED } = await import('./planJob.js');
const { getPlan, resetPlans } = await import('./planStore.js');
const { applyOps } = await import('./yueScoreApply.js');
type FakeOllama = Awaited<ReturnType<typeof startFakeOllama>>;
type FakeYue = Awaited<ReturnType<typeof startFakeYue>>;
type ScoreStatus = import('./scoreStatus.js').ScoreStatus;

const read = contract('read-ok');
const base = contract('apply-write-phrase').request.body as { abc: string; style: string };
const SONG = 'song-phrase';
const status = (): ScoreStatus => ({
  eligibility: { state: 'eligible' },
  source: { songId: SONG, activeVersionId: 'v1', abc: base.abc, style: base.style, lyrics: '', fingerprint: 'l1|v1|v1' } as ScoreStatus['source'],
  read: { ok: true, error: null, messages: [], chordsPresent: true, bpm: 87, seconds: 179.3, tokens: 1832, facts: read.response.body.facts as never },
});
const COMPOUND = 'jazz chords in the chorus, 88 BPM, add a 4-bar sax phrase after it';

let ollama: FakeOllama;
let yue: FakeYue;
beforeAll(async () => { yue = await startFakeYue(); });
afterAll(async () => { await yue.close(); });
afterEach(async () => { await ollama?.close(); resetQueue(); resetPlans(); });

const deps = () => planDeps({
  planner: { url: ollama.url, model: 'qwen3:14b' }, status: async () => status(),
  apply: (abc, style, ops) => applyOps(abc, style, ops, { label: 'YUE2', url: yue.url, apiKey: '' }),
});
const settled = async (id: string) => {
  await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(id)?.status), { timeout: 5000 });
  return getJob(id)!;
};
type Chat = { messages: Array<{ role: string; content: string }>; response_format: { json_schema: { schema: any } } };
const chats = () => ollama.requests.filter((r) => r.path === '/v1/chat/completions').map((r) => r.body as Chat);
const feedback = (n: number) => chats()[n].messages.at(-1)!.content;

describe('WRITE PHRASE plan (F-026)', () => {
  it('feeds yue-server refusals back word for word, with the free bars and the beat sums, then plans the compound request', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(phrasePlan('apply-write-phrase-vocal-sings'), phrasePlan('apply-write-phrase-beat-sum'), phrasePlan('apply-write-phrase-compound'));
    expect((await settled(startPlan(SONG, COMPOUND, deps()).id)).status).toBe('done');
    const first = chats()[0];
    expect(first.messages[1].content).toContain('FREE BARS (the Vocal rests 4 or more bars in a row; a phrase goes only here): 1-10, 47-65');
    expect(first.messages[1].content).toContain('PHRASE LENGTH: a WRITE_PHRASE op has exactly 4 bars');
    const phrase = first.response_format.json_schema.schema.properties.ops.items.anyOf.find((o: any) => o.properties.op.const === 'WRITE_PHRASE');
    expect(phrase.properties.bars).toMatchObject({ minItems: 4, maxItems: 4 });
    expect(feedback(1)).toBe('Your op list was rejected:\n- op 1 (WRITE_PHRASE): the Vocal sings in bars 11-12; free: 1-10, 47-65\n'
      + 'Return a corrected, complete op list as JSON only.');
    expect(feedback(2)).toContain('- op 1 (WRITE_PHRASE): bar 3 of the phrase (score bar 59) sums to 3.5 beats, the meter needs 4 (too short by 0.5)');
    const plan = getPlan(SONG)!;
    expect(plan.attempts).toBe(3);
    expect(plan.ops.map((o) => o.op)).toEqual(['SET_TEMPO', 'REHARMONIZE', 'WRITE_PHRASE']);
    expect(plan.style).toBe('dark pop, 88 bpm, F minor, female vocal, tenor saxophone');
    expect(plan.style.match(/tenor saxophone/g)).toHaveLength(1);
  });

  it("rejects a phrase the sanity gates refuse with yue-server's reason, and ends in 'check failed' after 3", async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(phrasePlan('apply-write-phrase-sanity'));
    const job = await settled(startPlan(SONG, 'add a sax phrase after the chorus', deps()).id);
    expect(job.error).toBe(`${CHECK_FAILED}: WRITE_PHRASE bars 57-60: the phrase has 3 notes; write at least 4`);
    expect(chats()).toHaveLength(3);
    expect(feedback(1)).toContain('- WRITE_PHRASE bars 57-60: the phrase has 3 notes; write at least 4');
    expect(getPlan(SONG)).toBeUndefined();
  });

  it('refuses a phrase where the Vocal sings, naming the bars that are free (F-026 #5)', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(phrasePlan('apply-write-phrase-vocal-sings'));
    const job = await settled(startPlan(SONG, 'add a 4-bar sax phrase in the verse', deps()).id);
    expect(job.error).toBe(`${CHECK_FAILED}: op 1 (WRITE_PHRASE): the Vocal sings in bars 11-12; free: 1-10, 47-65`);
  });
});
