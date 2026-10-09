/** yue-server's /v1/splices client against fakeYue's replay of CB-1's recorded contract (D-039). */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';

const { spliceContract, startFakeYue } = await import('../../../test-fakes/fakeYue.js');
const { cancelSplice, fetchSpliceAudio, fetchSpliceGrid, isChain, spliceStatus, submitSplice, SpliceRefused } = await import('./yueSpliceClient.js');
type FakeYue = Awaited<ReturnType<typeof startFakeYue>>;
type SpliceSpec = import('./yueSpliceClient.js').SpliceSpec;

let yue: FakeYue;
const target = () => ({ label: 'YUE2', url: yue.url, apiKey: 'k' });
const recorded = (name: Parameters<typeof spliceContract>[0]) => spliceContract(name).request.form.spec as unknown as SpliceSpec;
beforeAll(async () => { yue = await startFakeYue([]); });
afterAll(async () => { await yue.close(); });
afterEach(() => { yue.splice = { fixture: spliceContract('splice-ok'), specs: [], cancelled: new Set() }; yue.requests.length = 0; });

describe('yueSpliceClient', () => {
  it('submits the base audio and the spec as multipart, our job id as the Idempotency-Key; reads the ok verdict', async () => {
    const spec = { ...recorded('splice-ok'), render_job: 'yue-7', edited_abc: 'X:1' };
    const id = await submitSplice(target(), Buffer.from('fLaC-base'), 'base.flac', spec, 'job-1');
    expect(id).toBe('sp-0001');
    expect(yue.splice.specs).toEqual([spec]);
    const state = await spliceStatus(target(), id);
    expect(state).toMatchObject({ state: 'done', result: { verdict: 'ok', kind: 'REHARMONIZE', bars: [9, 16], joins_s: [16.2, 32.2], null_test: { samples: 1570000, different: 0 } } });
    expect((await fetchSpliceAudio(target(), id)).toString()).toBe('RIFF-spliced-float32');
  });

  it('a REPEAT whose seam steps too far reads verdict rerender with the reason (D-154)', async () => {
    yue.splice.fixture = spliceContract('splice-rerender');
    const id = await submitSplice(target(), Buffer.from('a'), 'a.flac', recorded('splice-rerender'), 'job-2');
    expect(await spliceStatus(target(), id)).toMatchObject({ state: 'done', result: { verdict: 'rerender', reason: 'level_step', detail: expect.stringContaining('+10.4 dB') } });
  });

  it('a failed splice reads its error; a running one its stage; a cancel ends it', async () => {
    yue.splice.fixture = spliceContract('splice-failed');
    const failed = await submitSplice(target(), Buffer.from('a'), 'a.flac', recorded('splice-failed'), 'job-3');
    expect(await spliceStatus(target(), failed)).toEqual({ state: 'failed', error: 'render job job-0001 has no audio on this server' });
    yue.splice.fixture = spliceContract('splice-hold');
    const held = await submitSplice(target(), Buffer.from('a'), 'a.flac', recorded('splice-hold'), 'job-4');
    expect(await spliceStatus(target(), held)).toMatchObject({ state: 'running', stage: 'tracking_base', progress: 0.5 });
    await cancelSplice(target(), held);
    expect(await spliceStatus(target(), held)).toMatchObject({ state: 'failed', cancelled: true });
  });

  it('a refused submit (422: not spliced, a bad span) is a SpliceRefused carrying the detail: the caller renders the whole song', async () => {
    yue.splice.submit = { status: 422, detail: 'REWRITE_LYRICS is not spliced; the server renders the whole song for it' };
    const err = await submitSplice(target(), Buffer.from('a'), 'a.flac', recorded('splice-ok'), 'job-5').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SpliceRefused);
    expect((err as Error).message).toContain('REWRITE_LYRICS is not spliced');
  });

  it('grids: the recorded one when yue-server has it, null when not (404)', async () => {
    const id = await submitSplice(target(), Buffer.from('a'), 'a.flac', recorded('splice-ok'), 'job-6');
    yue.splice.grids = { base: { grid_v: 1, downbeats: [0.2] } };
    expect(await fetchSpliceGrid(target(), id, 'base')).toEqual({ grid_v: 1, downbeats: [0.2] });
    expect(await fetchSpliceGrid(target(), id, 'out')).toBeNull();
  });

  it('a chain (C4, spec v2): steps in, one verdict out with every step row; a rerender names the failing step', async () => {
    yue.splice.fixture = spliceContract('splice-chain-ok');
    const spec = { ...recorded('splice-chain-ok'), render_job: 'yue-7' };
    const id = await submitSplice(target(), Buffer.from('a'), 'a.flac', spec, 'job-7');
    expect(yue.splice.specs).toEqual([spec]);
    const done = await spliceStatus(target(), id);
    expect(done).toMatchObject({ state: 'done', result: { verdict: 'ok', kind: 'several', step: null, bars: [9, 22], joins_s: [20.2, 28.2, 16.2],
      steps: [{ kind: 'REHARMONIZE', bars: [19, 22] }, { kind: 'CUT', bars: [9, 16] }] } });
    expect(done.state === 'done' && isChain(done.result)).toBe(true);
    yue.splice.fixture = spliceContract('splice-chain-rerender');
    const re = await submitSplice(target(), Buffer.from('a'), 'a.flac', recorded('splice-chain-rerender'), 'job-8');
    expect(await spliceStatus(target(), re)).toMatchObject({ state: 'done', result: { verdict: 'rerender', reason: 'level_step', step: 2, steps: [{ verdict: 'ok' }, { verdict: 'rerender' }] } });
    yue.splice.fixture = spliceContract('splice-chain-hold');
    const held = await submitSplice(target(), Buffer.from('a'), 'a.flac', { ...recorded('splice-chain-hold'), render_job: 'yue-9' }, 'job-9');
    expect(await spliceStatus(target(), held)).toMatchObject({ state: 'running', stage: 'tracking_base' });
  });
});
