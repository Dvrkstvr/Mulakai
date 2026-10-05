/** The SCORE store against a mocked server: load and rehydrate, PLAN → poll → plan ready, a refused
 * PLAN, CANCEL while queued and while planning, a lost run, and APPLY & RENDER's expiry check. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ScorePlan, ScorePlanPress, ScorePlanRun, ScorePlanStart, ScorePlanState, ScoreReferent, ScoreStatusView } from './api';

const scoreStatus = vi.fn<(id: string) => Promise<ScoreStatusView>>();
const scorePlanState = vi.fn<(id: string) => Promise<ScorePlanState>>();
const startScorePlan = vi.fn<(id: string, request: string, press?: ScorePlanPress) => Promise<ScorePlanStart>>();
const cancelScorePlan = vi.fn<(id: string) => Promise<unknown>>();
const startScoreRender = vi.fn<(id: string, planId: string) => Promise<unknown>>();
vi.mock('./api', () => ({ api: {
  scoreStatus: (id: string) => scoreStatus(id), scorePlanState: (id: string) => scorePlanState(id),
  startScorePlan: (id: string, r: string, p?: ScorePlanPress) => startScorePlan(id, r, p), cancelScorePlan: (id: string) => cancelScorePlan(id),
  startScoreRender: (id: string, p: string) => startScoreRender(id, p), scoreRenderState: async () => ({ run: null }),
} }));

const { useScoreStore } = await import('./scoreStore');
const { POLL_MS } = await import('./transcribeStore');
const { PLAN_EXPIRED } = await import('./scoreCopy');

const S = 's1';
const P1 = { id: 'p1', request: 'jazz chords in the chorus, 88 BPM', ops: [], verdicts: [] } as unknown as ScorePlan;
const run = (over: Partial<ScorePlanRun>): ScorePlanRun => ({ jobId: 'j', request: 'jazz', status: 'running', reasons: [], planId: null, cause: null, ...over });
const store = () => useScoreStore.getState();
const phase = () => store().bySong[S]?.phase;

beforeEach(() => {
  vi.useFakeTimers();
  useScoreStore.setState({ bySong: {} });
  scoreStatus.mockResolvedValue({ state: 'eligible', baseVersion: 2, versions: 2 });
  scorePlanState.mockResolvedValue({ run: null, plan: null });
  cancelScorePlan.mockResolvedValue({ ok: true });
});
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('scoreStore', () => {
  it('load: eligible → asking; hidden stays hidden and asks nothing more', async () => {
    await store().load(S);
    expect(phase()).toEqual({ kind: 'asking' });
    scoreStatus.mockResolvedValue({ state: 'hidden' });
    useScoreStore.setState({ bySong: {} });
    scorePlanState.mockClear();
    await store().load(S);
    expect(phase()).toEqual({ kind: 'hidden' });
    expect(scorePlanState).not.toHaveBeenCalled();
  });

  it('load rehydrates a plan run in flight and keeps polling it to plan ready', async () => {
    scorePlanState.mockResolvedValueOnce({ run: run({ request: 'jazz chords', progressText: 'attempt 1 of 3' }), plan: null });
    await store().load(S);
    expect(phase()).toMatchObject({ kind: 'planning', attempt: 1 });
    expect(store().bySong[S].request).toBe('jazz chords');
    scorePlanState.mockResolvedValue({ run: run({ status: 'done', planId: 'p1' }), plan: P1 });
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(phase()).toEqual({ kind: 'ready' });
  });

  it('PLAN posts the trimmed request, then polls queued → planning → plan ready', async () => {
    await store().load(S);
    store().dispatch(S, { type: 'edit', request: '  jazz chords in the chorus, 88 BPM ' });
    startScorePlan.mockResolvedValue({ jobId: 'j', queuePosition: 2 });
    await store().plan(S);
    expect(startScorePlan).toHaveBeenCalledWith(S, 'jazz chords in the chorus, 88 BPM', { referent: null });
    expect(phase()).toEqual({ kind: 'queued', ahead: 2 });
    scorePlanState.mockResolvedValue({ run: run({ progressText: 'attempt 2 of 3 · bar 5 had 31/32 units' }), plan: null });
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(phase()).toMatchObject({ kind: 'planning', attempt: 2, note: 'bar 5 had 31/32 units' });
    scorePlanState.mockResolvedValue({ run: run({ status: 'done' }), plan: P1 });
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(store().bySong[S]).toMatchObject({ phase: { kind: 'ready' }, plan: P1 });
  });

  it('PLAN does nothing with an empty field; a refused PLAN shows the reason', async () => {
    await store().load(S);
    await store().plan(S);
    expect(startScorePlan).not.toHaveBeenCalled();
    store().dispatch(S, { type: 'edit', request: 'x' });
    startScorePlan.mockRejectedValue(new Error('the queue is full (10 jobs waiting)'));
    await store().plan(S);
    expect(store().bySong[S]).toMatchObject({ phase: { kind: 'asking' }, error: 'the queue is full (10 jobs waiting)' });
  });

  it('CANCEL while queued goes back to asking with the text; while planning it waits for the unload', async () => {
    await store().load(S);
    store().dispatch(S, { type: 'edit', request: 'jazz' });
    startScorePlan.mockResolvedValue({ jobId: 'j', queuePosition: 1 });
    await store().plan(S);
    await store().cancel(S);
    expect(cancelScorePlan).toHaveBeenCalledWith(S);
    expect(store().bySong[S]).toMatchObject({ phase: { kind: 'asking' }, request: 'jazz' });

    startScorePlan.mockResolvedValue({ jobId: 'j2', queuePosition: 0 });
    await store().plan(S);
    await store().cancel(S);
    expect(phase()).toMatchObject({ kind: 'planning', cancelling: true });
    scorePlanState.mockResolvedValue({ run: run({ status: 'failed', error: 'Aborted' }), plan: null });
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(phase()).toMatchObject({ kind: 'planning', cancelling: true });
    scorePlanState.mockResolvedValue({ run: run({ status: 'failed', error: 'Aborted', cause: 'cancelled' }), plan: null });
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(store().bySong[S]).toMatchObject({ phase: { kind: 'asking' }, request: 'jazz', plan: null });
  });

  it('a run the server no longer has (restart) ends the wait with plan expired', async () => {
    await store().load(S);
    store().dispatch(S, { type: 'edit', request: 'jazz' });
    startScorePlan.mockResolvedValue({ jobId: 'j', queuePosition: 0 });
    await store().plan(S);
    scorePlanState.mockResolvedValue({ run: null, plan: null });
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(phase()).toEqual({ kind: 'checkFailed', reasons: [PLAN_EXPIRED] });
  });

  it('APPLY & RENDER on a plan the server lost is refused as expired, starting nothing (F-024 #4)', async () => {
    scorePlanState.mockResolvedValueOnce({ run: run({ status: 'done' }), plan: P1 });
    await store().load(S);
    expect(phase()).toEqual({ kind: 'ready' });
    startScoreRender.mockResolvedValue({ refused: 'plan expired: the server restarted or a newer plan replaced it' });
    await store().apply(S);
    expect(startScoreRender).toHaveBeenCalledWith(S, 'p1');
    expect(phase()).toEqual({ kind: 'stale', reason: 'plan expired: the server restarted or a newer plan replaced it' });
  });

  describe('the pick and REVISE (F-032, F-033)', () => {
    const CHORUS2: ScoreReferent = { kind: 'section', section: 5, label: 'chorus', occurrence: 2, of: 3, bars: [29, 36] };
    const PINNED = { ...P1, referent: { ...CHORUS2, section: 5 } } as ScorePlan;

    it('PLAN sends the pick, pinned at the press', async () => {
      await store().load(S);
      store().dispatch(S, { type: 'pick', pick: CHORUS2 });
      store().dispatch(S, { type: 'edit', request: 'make this jazzier' });
      startScorePlan.mockResolvedValue({ jobId: 'j', queuePosition: 0 });
      await store().plan(S);
      expect(startScorePlan).toHaveBeenCalledWith(S, 'make this jazzier', { referent: CHORUS2 });
      expect(store().bySong[S]).toMatchObject({ revising: false, phase: { kind: 'planning' } });
      scorePlanState.mockResolvedValue({ run: run({ status: 'done' }), plan: P1 });
      await vi.advanceTimersByTimeAsync(POLL_MS); // ends the poll, so the next test's poll can start
    });

    it('a 409 stale pick queues nothing and draws the stale row', async () => {
      await store().load(S);
      store().dispatch(S, { type: 'pick', pick: CHORUS2 });
      store().dispatch(S, { type: 'edit', request: 'make this jazzier' });
      const stale = { picked: CHORUS2, now: { ...CHORUS2, bars: [37, 44] as [number, number] }, reason: 'moved' };
      startScorePlan.mockResolvedValue({ stale, error: 'the selection is stale: moved' });
      await store().plan(S);
      expect(store().bySong[S]).toMatchObject({ phase: { kind: 'asking' }, stale, error: null });
    });

    it('REVISE sends the plan id and its pinned referent, then polls to plan 2', async () => {
      scorePlanState.mockResolvedValueOnce({ run: run({ status: 'done' }), plan: PINNED });
      await store().load(S);
      expect(store().bySong[S].pick).toEqual(PINNED.referent); // the chip shows what the plan was made for
      store().dispatch(S, { type: 'edit', request: 'not so many chords' });
      startScorePlan.mockResolvedValue({ jobId: 'j2', queuePosition: 0 });
      await store().revise(S);
      expect(startScorePlan).toHaveBeenCalledWith(S, 'not so many chords', { referent: PINNED.referent, revise: 'p1' });
      expect(store().bySong[S]).toMatchObject({ revising: true, previous: PINNED, plan: null });
      const P2 = { ...PINNED, id: 'p2', revision: 2 } as ScorePlan;
      scorePlanState.mockResolvedValue({ run: run({ status: 'done', revise: 'p1' }), plan: P2 });
      await vi.advanceTimersByTimeAsync(POLL_MS);
      expect(store().bySong[S]).toMatchObject({ phase: { kind: 'ready' }, plan: P2, revising: false });
    });

    it('REVISE after ✕ plans the whole song; it does nothing while the request is unchanged', async () => {
      scorePlanState.mockResolvedValueOnce({ run: run({ status: 'done' }), plan: PINNED });
      await store().load(S);
      await store().revise(S);
      expect(startScorePlan).not.toHaveBeenCalled();
      store().dispatch(S, { type: 'pick', pick: null });
      store().dispatch(S, { type: 'edit', request: 'the whole song instead' });
      startScorePlan.mockResolvedValue({ jobId: 'j3', queuePosition: 1 });
      await store().revise(S);
      expect(startScorePlan).toHaveBeenCalledWith(S, 'the whole song instead', { referent: null, revise: 'p1' });
    });
  });
});
