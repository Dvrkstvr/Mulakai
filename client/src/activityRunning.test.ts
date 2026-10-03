import { describe, it, expect } from 'vitest';
import type { ActiveGeneration } from './api';
import type { GenerationJob } from './generationStore';
import type { SingleEditorJob } from './editorJob';
import { runningRows, type RunningSources } from './activityRunning';

const idle = (over: Partial<RunningSources> = {}): RunningSources => ({
  genJobs: [], editorJobs: [], splitJob: null,
  transcribe: { stage: 'idle' }, readLyrics: { stage: 'idle' }, timings: {}, active: null, ...over,
});

const active = (over: Partial<ActiveGeneration>): ActiveGeneration =>
  ({ kind: 'analyze', jobId: 'a1', startedAt: 1, status: 'running', ...over });

const gen = { key: 'g1', jobId: 'g1', title: 'Neon Harbor', caption: '', stage: 'running', startedAt: 1, draft: {}, progress: 0.41 } as GenerationJob;

describe('runningRows', () => {
  it('is empty when nothing runs', () => {
    expect(runningRows(idle())).toEqual([]);
  });

  it('lists a generation with its progress, wearing the AI shader', () => {
    expect(runningRows(idle({ genJobs: [gen] }))).toMatchObject([
      { kind: 'generate', label: 'GENERATING', title: 'Neon Harbor', progress: 0.41, ai: true },
    ]);
  });

  it('leaves settled jobs out', () => {
    expect(runningRows(idle({ genJobs: [{ ...gen, stage: 'failed' }] }))).toEqual([]);
  });

  it('keeps transcribe, read lyrics, timings and split plain', () => {
    const rows = runningRows(idle({
      transcribe: { stage: 'running', progress: 0.72 }, readLyrics: { stage: 'running' }, timings: { v1: { stage: 'running' } },
      splitJob: {
        kind: 'split', key: 'x', jobId: 'x', splitJobId: 'x', songId: 's', layerId: 'l', startedAt: 3, stage: 'running',
        stems: [{ kind: 'vocals', status: 'done' }, { kind: 'drums', status: 'running' }],
      },
    }));
    expect(rows.map((r) => [r.kind, r.ai])).toEqual([['split', false], ['transcribe', false], ['lyrics', false], ['timings', false]]);
    expect(rows[0].progress).toBe(0.5);
    expect(rows[1].progress).toBe(0.72);
  });

  it("matches the server's lock to this tab's job instead of listing it twice, and marks it abortable", () => {
    const editorJob = { kind: 'repaint', jobId: 'r1', songId: 's1', layerId: 'l1', startedAt: 2, stage: 'running' } as SingleEditorJob;
    const rows = runningRows(idle({ editorJobs: [editorJob], active: active({ kind: 'repaint', jobId: 'r1', songId: 's1' }) }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'repaint', label: 'REPAINTING', abortable: true, ai: true });
  });

  it('matches by kind when this tab has no id for the job', () => {
    const rows = runningRows(idle({ transcribe: { stage: 'running' }, active: active({ kind: 'transcribe', jobId: 't1' }) }));
    expect(rows).toHaveLength(1);
    expect(rows[0].abortable).toBe(true);
  });

  it("adds the lock's own row for a job no store here tracks (ANALYZE AUDIO, another tab)", () => {
    const rows = runningRows(idle({ readLyrics: { stage: 'running' }, active: active({ kind: 'analyze', title: 'Night Drive' }) }));
    expect(rows.map((r) => [r.kind, r.abortable, r.ai])).toEqual([['lyrics', false, false], ['analyze', true, true]]);
    expect(rows[1]).toMatchObject({ label: 'ANALYZING AUDIO', title: 'Night Drive' });
  });

  it('ignores a lock that has already settled', () => {
    expect(runningRows(idle({ active: active({ status: 'done' }) }))).toEqual([]);
  });

  it('lists every generation and editor job this tab runs, one row each', () => {
    const repaint = { kind: 'repaint', key: 'e1', jobId: 'e1', songId: 's1', layerId: 'l1', startedAt: 2, stage: 'running' } as SingleEditorJob;
    const rows = runningRows(idle({
      genJobs: [gen, { ...gen, key: 'g2', jobId: 'g2', title: 'Second' }],
      editorJobs: [repaint, { ...repaint, key: 'e2', jobId: 'e2' }],
    }));
    expect(rows.map((r) => [r.kind, r.jobId])).toEqual([['generate', 'g1'], ['generate', 'g2'], ['repaint', 'e1'], ['repaint', 'e2']]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(4);
  });

  it('leaves a job still waiting in the queue to UP NEXT, by its id or its queue position', () => {
    const repaint = { kind: 'repaint', jobId: 'e1', songId: 's1', layerId: 'l1', startedAt: 2, stage: 'running' } as SingleEditorJob;
    const rows = runningRows(idle({
      genJobs: [{ ...gen, queuePosition: 1 }],
      editorJobs: [repaint],
      readLyrics: { stage: 'running', jobId: 'rl1' },
      transcribe: { stage: 'running', jobId: 't1' },
      timings: { v1: { stage: 'running', jobId: 'tm1' } },
      queuedIds: new Set(['e1', 'rl1', 'tm1']),
    }));
    expect(rows.map((r) => r.kind)).toEqual(['transcribe']);
  });
});
