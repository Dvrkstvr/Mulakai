/** R-012: the golden path's Activity drawer listed a finished generation twice, RUNNING and DONE.
 * The RUNNING row came from apiStatusStore's last `/active` snapshot, taken while the job still
 * held the server's lock: once generationStore settled it, nothing matched that holder any more,
 * so it got a row of its own until the next poll. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ActiveGeneration } from './api';

const activeGeneration = vi.fn();
vi.mock('./api', () => ({
  api: {
    activeGeneration: () => activeGeneration(),
    songDetail: async () => ({ layers: [] }),
    listSongs: async () => [],
  },
  ApiError: class ApiError extends Error {},
}));

const { useActivityStore } = await import('./activityStore');
const { trackActivity } = await import('./activityTracking');
const { useApiStatusStore } = await import('./apiStatusStore');
const { useGenerationStore } = await import('./generationStore');
const { useEditorJobStore } = await import('./editorJobStore');
const { runningRows } = await import('./activityRunning');
import type { GenerationJob } from './generationStore';
import type { SingleEditorJob } from './editorJob';

const gen = (over: Partial<GenerationJob>): GenerationJob =>
  ({ jobId: 'g1', title: 'Copper Sky', caption: '', stage: 'loading', startedAt: 1, draft: { prompt: 'p' }, ...over });

const lock = (over: Partial<ActiveGeneration> = {}): ActiveGeneration =>
  ({ kind: 'generate', jobId: 'g1', title: 'Copper Sky', startedAt: 1, status: 'loading', ...over });

/** The drawer's RUNNING section, from the live stores as useRunningRows reads them. */
const rows = () => runningRows({
  genJob: useGenerationStore.getState().job,
  editorJob: useEditorJobStore.getState().editorJob,
  splitJob: useEditorJobStore.getState().splitJob,
  transcribe: { stage: 'idle' }, readLyrics: { stage: 'idle' }, timings: {},
  active: useApiStatusStore.getState().active,
});

let untrack: () => void;

beforeEach(() => {
  useActivityStore.setState({ entries: [], drawerOpen: false });
  useGenerationStore.setState({ job: null, otherLock: null });
  useEditorJobStore.setState({ editorJob: null, splitJob: null });
  useApiStatusStore.setState({ active: null, aborting: false });
  activeGeneration.mockReset();
  untrack = trackActivity();
});

afterEach(() => untrack());

describe('a settled job leaves no RUNNING row behind', () => {
  it('a generation that finishes shows only its DONE row, not the lock snapshot taken while it loaded', async () => {
    activeGeneration.mockResolvedValue({ active: lock() });
    await useApiStatusStore.getState().poll();
    useGenerationStore.setState({ job: gen({ stage: 'loading' }) });
    expect(rows()).toHaveLength(1);

    useGenerationStore.setState({ job: gen({ stage: 'done', songId: 's1' }) });

    expect(useActivityStore.getState().entries.map((e) => e.status)).toEqual(['done']);
    expect(rows()).toEqual([]);
  });

  it('a lock poll already in flight when the job settles cannot bring its holder back', async () => {
    let answer!: (v: { active: ActiveGeneration }) => void;
    activeGeneration.mockReturnValue(new Promise((r) => { answer = r; }));
    useGenerationStore.setState({ job: gen({ stage: 'running' }) });
    const inFlight = useApiStatusStore.getState().poll();

    useGenerationStore.setState({ job: gen({ stage: 'done', songId: 's1' }) });
    answer({ active: lock({ status: 'running' }) });
    await inFlight;

    expect(useApiStatusStore.getState().active).toBeNull();
    expect(rows()).toEqual([]);
  });

  it('an editor job that finishes clears the snapshot too', async () => {
    activeGeneration.mockResolvedValue({ active: lock({ kind: 'repaint', jobId: 'r1', songId: 's1', status: 'running' }) });
    await useApiStatusStore.getState().poll();
    const repaint = { kind: 'repaint', jobId: 'r1', songId: 's1', layerId: 'l1', startedAt: 5, stage: 'running' } as SingleEditorJob;
    useEditorJobStore.setState({ editorJob: repaint });

    useEditorJobStore.setState({ editorJob: { ...repaint, stage: 'done' } as SingleEditorJob });

    expect(rows()).toEqual([]);
  });

  it('a start the server refused keeps the row of the job that does hold the lock', async () => {
    activeGeneration.mockResolvedValue({ active: lock({ kind: 'analyze', jobId: 'a1', status: 'running' }) });
    await useApiStatusStore.getState().poll();
    useGenerationStore.setState({ job: gen({ jobId: '', stage: 'loading' }) });

    useGenerationStore.setState({ job: gen({ jobId: '', stage: 'failed', error: 'an audio analysis is already in progress' }) });

    expect(useActivityStore.getState().entries.map((e) => e.status)).toEqual(['failed']);
    expect(rows().map((r) => r.kind)).toEqual(['analyze']);
  });

  it('the next poll still picks up whatever holds the lock now', async () => {
    useGenerationStore.setState({ job: gen({ stage: 'running' }) });
    useGenerationStore.setState({ job: gen({ stage: 'done', songId: 's1' }) });
    activeGeneration.mockResolvedValue({ active: lock({ kind: 'analyze', jobId: 'a1', status: 'running' }) });

    await useApiStatusStore.getState().poll();

    expect(rows().map((r) => r.kind)).toEqual(['analyze']);
  });
});
