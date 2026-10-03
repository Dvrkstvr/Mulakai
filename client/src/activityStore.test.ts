import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const songDetail = vi.fn();
vi.mock('./api', () => ({
  api: {
    songDetail: (id: string) => songDetail(id),
    listSongs: async () => [],
  },
  ApiError: class ApiError extends Error {},
}));

const { useActivityStore, ACTIVITY_CAP } = await import('./activityStore');
const { trackActivity } = await import('./activityTracking');
const { useGenerationStore } = await import('./generationStore');
const { useEditorJobStore } = await import('./editorJobStore');
const { useTranscribeStore } = await import('./transcribeStore');
const { useTimingsStore } = await import('./timingsStore');
import type { GenerationJob } from './generationStore';
import type { SingleEditorJob, SplitJobState } from './editorJob';

const gen = (over: Partial<GenerationJob>): GenerationJob =>
  ({ jobId: 'g1', title: 'Copper Sky', caption: '', stage: 'running', startedAt: 1, draft: { prompt: 'p' }, ...over });

const repaint = (over: Partial<SingleEditorJob>): SingleEditorJob =>
  ({ kind: 'repaint', jobId: 'r1', songId: 's1', layerId: 'l1', startedAt: 5, stage: 'running', ...over }) as SingleEditorJob;

let untrack: () => void;

beforeEach(() => {
  useActivityStore.setState({ entries: [], drawerOpen: false });
  useGenerationStore.setState({ job: null, otherLock: null });
  useEditorJobStore.setState({ editorJob: null, splitJob: null });
  useTranscribeStore.setState({ stage: 'idle', error: undefined });
  useTimingsStore.setState({ runs: {} });
  songDetail.mockReset();
  untrack = trackActivity();
});

afterEach(() => untrack());

const entries = () => useActivityStore.getState().entries;

describe('activity tracking', () => {
  it('records a generation that finishes as DONE, opening the new song', () => {
    useGenerationStore.setState({ job: gen({}) });
    useGenerationStore.setState({ job: gen({ stage: 'done', songId: 's9' }) });
    expect(entries()).toMatchObject([{ kind: 'generate', status: 'done', songId: 's9', title: 'Copper Sky', opens: 'editor', badge: 'NEW SONG' }]);
  });

  it('records a failed generation with its reason and the draft RETRY reopens', () => {
    useGenerationStore.setState({ job: gen({ stage: 'loading' }) });
    useGenerationStore.setState({ job: gen({ stage: 'failed', error: 'CUDA out of memory' }) });
    expect(entries()).toMatchObject([{ status: 'failed', error: 'CUDA out of memory', draft: { prompt: 'p' } }]);
  });

  it('ignores a job that is only replaced, cleared or still running', () => {
    useGenerationStore.setState({ job: gen({}) });
    useGenerationStore.setState({ job: gen({ progress: 0.5 }) });
    useGenerationStore.setState({ job: gen({ startedAt: 2, stage: 'failed' }) });
    useGenerationStore.setState({ job: null });
    expect(entries()).toEqual([]);
  });

  it("badges a finished repaint with its layer's new take once the song is read", async () => {
    songDetail.mockResolvedValue({ layers: [{ id: 'l1', name: 'Vocals', versions: [{}, {}, {}, {}, {}] }] });
    useEditorJobStore.setState({ editorJob: repaint({}) });
    useEditorJobStore.setState({ editorJob: repaint({ stage: 'done' }) });
    expect(entries()[0]).toMatchObject({ kind: 'repaint', status: 'done', songId: 's1', badge: 'NEW TAKE' });
    await vi.waitFor(() => expect(entries()[0].badge).toBe('VOCALS v5'));
  });

  it("keeps a failed editor job's retry", () => {
    const retry = vi.fn(async () => {});
    useEditorJobStore.setState({ editorJob: repaint({}) });
    useEditorJobStore.setState({ editorJob: repaint({ stage: 'failed', error: 'boom', retry }) });
    entries()[0].retry?.();
    expect(retry).toHaveBeenCalled();
  });

  it('counts the stems a split extracted', () => {
    const split = (over: Partial<SplitJobState>): SplitJobState => ({
      kind: 'split', jobId: 'x', splitJobId: 'x', songId: 's1', layerId: 'l1', startedAt: 7, stage: 'running',
      stems: [{ kind: 'vocals', status: 'running' }, { kind: 'drums', status: 'running' }], ...over,
    });
    useEditorJobStore.setState({ splitJob: split({}) });
    useEditorJobStore.setState({ splitJob: split({ stage: 'done', stems: [{ kind: 'vocals', status: 'done' }, { kind: 'drums', status: 'failed' }] }) });
    expect(entries()).toMatchObject([{ kind: 'split', status: 'done', badge: '1 STEM' }]);
  });

  it('records TRANSCRIBE settling as DONE that opens Create', () => {
    useTranscribeStore.setState({ stage: 'running' });
    useTranscribeStore.setState({ stage: 'idle' });
    expect(entries()).toMatchObject([{ kind: 'transcribe', status: 'done', opens: 'create' }]);
  });

  it('records only failed word-timing reads', () => {
    useTimingsStore.setState({ runs: { v1: { stage: 'running' }, v2: { stage: 'running' } } });
    useTimingsStore.setState({ runs: { v1: { stage: 'done' }, v2: { stage: 'failed', error: 'down' } } });
    expect(entries()).toMatchObject([{ kind: 'timings', status: 'failed', error: 'down' }]);
  });
});

describe('activityStore', () => {
  const entry = (id: string) => ({ id, kind: 'generate' as const, status: 'done' as const, at: 0, opens: null });

  it(`keeps the newest ${ACTIVITY_CAP} entries, newest first`, () => {
    for (let i = 0; i < ACTIVITY_CAP + 5; i++) useActivityStore.getState().record(entry(`e${i}`));
    const ids = entries().map((e) => e.id);
    expect(ids).toHaveLength(ACTIVITY_CAP);
    expect(ids[0]).toBe(`e${ACTIVITY_CAP + 4}`);
    expect(ids.at(-1)).toBe('e5');
  });

  it('clears DONE and FAILED together, and removes one entry', () => {
    const { record, remove, clear } = useActivityStore.getState();
    record(entry('a'));
    record({ ...entry('b'), status: 'failed' });
    remove('a');
    expect(entries().map((e) => e.id)).toEqual(['b']);
    clear();
    expect(entries()).toEqual([]);
  });
});
