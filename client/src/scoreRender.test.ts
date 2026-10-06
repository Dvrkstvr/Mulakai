/** APPLY & RENDER in the SCORE store (F-023): the render's progress as YuE2's stage and share, done
 * in lilac, TRUNCATED, RENDER FAILED with RETRY RENDER, CANCEL, a refusal, and SCORE reopened mid-render. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ScorePlan, ScorePlanState, ScoreRenderRun, ScoreRenderStart } from './api';

const scorePlanState = vi.fn<(id: string) => Promise<ScorePlanState>>();
const startScoreRender = vi.fn<(id: string, planId: string) => Promise<ScoreRenderStart>>();
const scoreRenderState = vi.fn<(id: string) => Promise<{ run: ScoreRenderRun | null }>>();
const cancelScoreRender = vi.fn<(id: string) => Promise<unknown>>();
vi.mock('./api', () => ({ api: {
  scoreStatus: async () => ({ state: 'eligible', baseVersion: 2, versions: 2 }), scorePlanState: (id: string) => scorePlanState(id),
  startScoreRender: (id: string, p: string) => startScoreRender(id, p), scoreRenderState: (id: string) => scoreRenderState(id),
  cancelScoreRender: (id: string) => cancelScoreRender(id),
} }));

const { useScoreStore } = await import('./scoreStore');
const { renderEvent } = await import('./scoreRender');
const { jobLine } = await import('./scoreCopy');
const { POLL_MS } = await import('./transcribeStore');

const S = 's1';
const P1 = { id: 'p1', request: '88 BPM', ops: [], verdicts: [] } as unknown as ScorePlan;
const r = (over: Partial<ScoreRenderRun>): ScoreRenderRun => ({ jobId: 'r1', planId: 'p1', status: 'running', version: null, cause: null, ...over });
const V3 = { id: 'v3', number: 3, seconds: 184, bpm: 88, truncated: false };
const store = () => useScoreStore.getState();
const at = () => store().bySong[S];
const tick = () => vi.advanceTimersByTimeAsync(POLL_MS);

async function open() {
  scorePlanState.mockResolvedValue({ run: { jobId: 'j', request: '88 BPM', status: 'done', reasons: [], planId: 'p1', cause: null }, plan: P1 });
  await store().load(S);
}
async function ready() {
  await open();
  expect(at().phase).toEqual({ kind: 'ready' });
}

beforeEach(() => {
  vi.useFakeTimers();
  useScoreStore.setState({ bySong: {} });
  scoreRenderState.mockResolvedValue({ run: null });
  startScoreRender.mockResolvedValue({ jobId: 'r1', queuePosition: 0 });
  cancelScoreRender.mockResolvedValue({ ok: true, aborted: true });
});
// Let any poll loop still sleeping see its state is gone, so the next test starts with none running.
afterEach(async () => { useScoreStore.setState({ bySong: {} }); await vi.runOnlyPendingTimersAsync(); vi.useRealTimers(); vi.clearAllMocks(); });

describe('renderEvent', () => {
  it('names the stage and its share, never a whole-job percentage', () => {
    expect(renderEvent(r({ stage: 'synthesis', progress: 0.41, startedAt: 7 }))).toEqual({ type: 'renderProgress', ahead: 0, line: 'synthesizing audio 41%', startedAt: 7 });
    expect(jobLine({ kind: 'rendering', line: 'synthesizing audio 41%', startedAt: 0 }, 72_000)).toBe('RENDERING · synthesizing audio 41% · 1:12');
    expect(jobLine({ kind: 'renderQueued', ahead: 1 })).toBe('RENDERING · QUEUED · STARTS AFTER 1 JOB');
  });

  it('maps each end: saved, truncated, refused at its turn, cancelled, failed', () => {
    expect(renderEvent(r({ status: 'done', version: V3 }))).toEqual({ type: 'renderDone', saved: 'Saved base v3 · 88 BPM, 3:04', truncated: false });
    expect(renderEvent(r({ status: 'done', version: { ...V3, seconds: 360, truncated: true } }))).toEqual({
      type: 'renderDone', truncated: true, saved: 'TRUNCATED at 6:00, the song is cut short — v3 is saved; revert in VERSIONS or shorten and re-render' });
    expect(renderEvent(r({ status: 'failed', cause: 'refused', error: 'this song changed since the plan' }))).toEqual({ type: 'renderRefused', reason: 'this song changed since the plan' });
    expect(renderEvent(r({ status: 'failed', cause: 'cancelled', error: 'Aborted' }))).toEqual({ type: 'renderCancelled' });
    expect(renderEvent(r({ status: 'failed', cause: 'failed', error: 'CUDA out of memory' }))).toEqual({ type: 'renderFailed', error: 'CUDA out of memory' });
  });
});

describe('APPLY & RENDER in the store', () => {
  it('queued → rendering with the stage → done; the field and the plan are cleared', async () => {
    await ready();
    startScoreRender.mockResolvedValue({ jobId: 'r1', queuePosition: 1 });
    await store().apply(S);
    expect(startScoreRender).toHaveBeenCalledWith(S, 'p1');
    expect(at().phase).toEqual({ kind: 'renderQueued', ahead: 1 });
    scoreRenderState.mockResolvedValue({ run: r({ stage: 'semantic', progress: 0.5, startedAt: 3 }) });
    await tick();
    expect(at().phase).toEqual({ kind: 'rendering', line: 'generating song tokens 50%', startedAt: 3 });
    scoreRenderState.mockResolvedValue({ run: r({ status: 'done', version: V3 }) });
    await tick();
    expect(at()).toMatchObject({ phase: { kind: 'done', saved: 'Saved base v3 · 88 BPM, 3:04', truncated: false }, request: '', plan: null });
  });

  it('a failed render keeps the plan, and RETRY RENDER posts the same plan again', async () => {
    await ready();
    await store().apply(S);
    scoreRenderState.mockResolvedValue({ run: r({ status: 'failed', cause: 'failed', error: 'CUDA out of memory' }) });
    await tick();
    expect(at()).toMatchObject({ phase: { kind: 'renderFailed', error: 'CUDA out of memory' }, plan: P1 });
    startScoreRender.mockResolvedValue({ jobId: 'r2', queuePosition: 0 });
    await store().apply(S);
    expect(startScoreRender).toHaveBeenLastCalledWith(S, 'p1');
    expect(at().phase).toMatchObject({ kind: 'rendering' });
  });

  it('CANCEL while rendering aborts it and returns to the plan', async () => {
    await ready();
    await store().apply(S);
    await store().cancel(S);
    expect(cancelScoreRender).toHaveBeenCalledWith(S);
    expect(at()).toMatchObject({ phase: { kind: 'ready' }, plan: P1 });
  });

  it('a refusal at the click is stale with its reason; a queue refusal is an error line', async () => {
    await ready();
    startScoreRender.mockRejectedValueOnce(new Error('the queue is full (10 jobs waiting)'));
    await store().apply(S);
    expect(at()).toMatchObject({ phase: { kind: 'ready' }, error: 'the queue is full (10 jobs waiting)' });
    startScoreRender.mockResolvedValueOnce({ refused: 'a repaint 1:32–2:07 was queued after this plan' });
    await store().apply(S);
    expect(at().phase).toEqual({ kind: 'stale', reason: 'a repaint 1:32–2:07 was queued after this plan' });
  });

  it('SCORE reopened mid-render follows the render again', async () => {
    scoreRenderState.mockResolvedValue({ run: r({ stage: 'synthesis', progress: 0.1, startedAt: 2 }) });
    await open();
    expect(at().phase).toEqual({ kind: 'rendering', line: 'synthesizing audio 10%', startedAt: 2 });
    scoreRenderState.mockResolvedValue({ run: r({ status: 'done', version: { ...V3, truncated: true } }) });
    await tick();
    expect(at().phase).toMatchObject({ kind: 'done', truncated: true });
  });
});
