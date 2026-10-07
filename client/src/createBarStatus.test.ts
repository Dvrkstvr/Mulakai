import { describe, expect, it } from 'vitest';
import type { ActiveGeneration } from './api';
import { runningRows } from './activityRunning';
import { abortableGenKeys, draftChipText, genChips } from './createBarStatus';
import type { GenerationJob } from './generationStore';

const job = (over: Partial<GenerationJob>): GenerationJob =>
  ({ key: 'k1', jobId: 'j1', title: 'Neon Harbor', caption: 'synthwave', stage: 'running', startedAt: 1, draft: {}, ...over });
const active = (jobId: string): ActiveGeneration => ({ kind: 'generate', jobId, startedAt: 1, status: 'running' });
const rows = (genJobs: GenerationJob[], lock: ActiveGeneration | null, queued: string[] = []) => runningRows({
  genJobs, editorJobs: [], splitJob: null, transcribe: { stage: 'idle' }, readLyrics: { stage: 'idle' }, timings: {},
  active: lock, queuedIds: new Set(queued),
});

describe('genChips', () => {
  it('a running job: GENERATING, its title, progress, the shader veiled by it', () => {
    const { chips } = genChips([job({ progress: 0.42 })], new Set());
    expect(chips).toEqual([{ key: 'k1', jobId: 'j1', label: 'GENERATING', title: 'Neon Harbor', pct: '42%', veil: 0.42, ai: true, action: null }]);
  });

  it('falls back to the caption, and shows no percentage before progress is known', () => {
    expect(genChips([job({ title: '' })], new Set()).chips[0]).toMatchObject({ title: 'synthwave', pct: null });
  });

  it('a queued job: QUEUED · #n, plain, CANCEL', () => {
    const [c] = genChips([job({ stage: 'loading', queuePosition: 2, progress: 0.1 })], new Set()).chips;
    expect(c).toMatchObject({ label: 'QUEUED · #2', ai: false, pct: null, veil: undefined, action: 'cancel' });
  });

  it('no CANCEL before the submit answers with a job id', () => {
    expect(genChips([job({ jobId: '', stage: 'loading', queuePosition: 1 })], new Set()).chips[0].action).toBeNull();
  });

  it('an engine-stage share shows its percentage without a veil', () => {
    expect(genChips([job({ progress: 0.4, progressStage: 'synthesis' })], new Set()).chips[0]).toMatchObject({ pct: '40%', veil: undefined });
  });

  it('two chips at most, the rest counted for +N; settled jobs are left out', () => {
    const jobs = ['a', 'b', 'c', 'd'].map((k) => job({ key: k, jobId: k })).concat(job({ key: 'f', stage: 'failed' }));
    const { chips, overflow } = genChips(jobs, new Set());
    expect(chips.map((c) => c.key)).toEqual(['a', 'b']);
    expect(overflow).toBe(2);
  });
});

describe('ABORT only on the lock holder (runningRows decides)', () => {
  it('the running job that holds the lock gets ABORT; another running one does not', () => {
    const jobs = [job({ key: 'a', jobId: 'ja' }), job({ key: 'b', jobId: 'jb' })];
    const { chips } = genChips(jobs, abortableGenKeys(rows(jobs, active('jb'))));
    expect(chips.map((c) => c.action)).toEqual([null, 'abort']);
  });

  it('no ABORT when the lock is held by another kind of job, or nothing runs', () => {
    const jobs = [job({})];
    expect(abortableGenKeys(rows(jobs, { ...active('x'), kind: 'repaint' })).size).toBe(0);
    expect(abortableGenKeys(rows(jobs, null)).size).toBe(0);
  });

  it('a queued job never gets ABORT, even if it shares the lock id', () => {
    const jobs = [job({ queuePosition: 1, stage: 'loading' })];
    expect(genChips(jobs, abortableGenKeys(rows(jobs, active('j1'), ['j1']))).chips[0].action).toBe('cancel');
  });
});

describe('draftChipText', () => {
  const d = { title: '', titleSuggested: false, prompt: '', lyrics: '' };
  it('a typed title, else the prompt, else the first sung line', () => {
    expect(draftChipText({ ...d, title: 'Night Drive', prompt: 'lofi' })).toBe('Night Drive');
    expect(draftChipText({ ...d, title: 'Folder name', titleSuggested: true, prompt: 'lofi beat' })).toBe('lofi beat');
    expect(draftChipText({ ...d, lyrics: '[verse]\n  city lights\nmore' })).toBe('city lights');
    expect(draftChipText({ ...d })).toBe('New song');
  });
});
