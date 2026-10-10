import { describe, expect, it } from 'vitest';
import { createCardKind, draftChipText, genCard, isCreateBusy, landedCard, liveGenJobs, thinkChip } from './createBarStatus';
import type { GenerationJob } from './generationStore';

const job = (over: Partial<GenerationJob>): GenerationJob =>
  ({ key: 'k1', jobId: 'j1', title: 'Neon Harbor', caption: 'synthwave', stage: 'running', startedAt: 1, draft: {}, ...over });

describe('genCard (the oldest generation in flight, as the Create card)', () => {
  it('GENERATING, the title, elapsed and progress; the shader veiled by it', () => {
    expect(genCard(job({ progress: 0.42 }), 65_000, 0))
      .toEqual({ label: 'GENERATING', title: 'Neon Harbor', note: '1:05 elapsed · 42%', ai: true, failed: false, veil: 0.42 });
  });

  it('falls back to the caption; no percentage before progress is known', () => {
    expect(genCard(job({ title: '' }), 0, 0)).toMatchObject({ title: 'synthwave', note: '0:00 elapsed' });
  });

  it('LOADING MODEL before it runs', () => {
    expect(genCard(job({ stage: 'loading' }), 0, 0).label).toBe('LOADING MODEL');
  });

  it('QUEUED · #n: plain, with its place in line', () => {
    expect(genCard(job({ stage: 'loading', queuePosition: 2, progress: 0.1 }), 5_000, 0))
      .toMatchObject({ label: 'QUEUED · #2', ai: false, veil: undefined, note: 'starts after 2 jobs' });
  });

  it('an engine stage names the stage and its share, without a veil', () => {
    const c = genCard(job({ progress: 0.4, progressStage: 'synthesis' }), 0, 0);
    expect(c.veil).toBeUndefined();
    expect(c.note).toMatch(/^0:00 elapsed · .+ 40%$/);
  });

  it('counts the other generations in flight', () => {
    expect(genCard(job({}), 0, 2).note).toBe('0:00 elapsed · +2 more in Activity');
  });
});

describe('liveGenJobs', () => {
  it('keeps loading and running, oldest first; failed ones stay on the grid', () => {
    const jobs = [job({ key: 'a' }), job({ key: 'f', stage: 'failed' }), job({ key: 'b', stage: 'loading' }), job({ key: 'd', stage: 'done' })];
    expect(liveGenJobs(jobs).map((j) => j.key)).toEqual(['a', 'b']);
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

describe('thinkChip (Quick Start, as Create shows it)', () => {
  const idle = { phase: 'idle' as const, query: '', position: null, error: '' };

  it('THINKING with the idea, on the AI shader', () => {
    expect(thinkChip({ ...idle, phase: 'thinking', query: 'lucky idea' }, 'lucky idea'))
      .toEqual({ label: 'THINKING', title: 'lucky idea', note: 'QUICK START is writing the prompt, lyrics and details…', ai: true, failed: false });
  });

  it('QUEUED · #n, plain, while it waits its turn', () => {
    expect(thinkChip({ ...idle, phase: 'thinking', query: 'q', position: 2 }, 'q')).toMatchObject({ label: 'QUEUED · #2', ai: false, note: 'QUICK START waits its turn · starts after 2 jobs' });
  });

  it("COULDN'T WRITE while a failed idea waits for RETRY", () => {
    expect(thinkChip({ ...idle, error: 'the LM job failed' }, 'q')).toMatchObject({ label: "COULDN'T WRITE", failed: true, title: 'q', note: 'the LM job failed · RETRY in Create' });
  });

  it('nothing when idle, or once the failed idea is gone', () => {
    expect(thinkChip(idle, undefined)).toBeNull();
    expect(thinkChip({ ...idle, error: 'x' }, undefined)).toBeNull();
  });
});

describe('isCreateBusy (the bar shows the Create card instead of FEELING LUCKY and the input)', () => {
  const think = { label: 'THINKING', title: 'q', note: '', ai: true, failed: false };
  it('busy while a draft holds anything, an idea is being written, or a song generates', () => {
    expect(isCreateBusy(false, null, false)).toBe(true);
    expect(isCreateBusy(true, think, false)).toBe(true);
    expect(isCreateBusy(true, null, true)).toBe(true);
  });
  it('free with an empty draft and nothing writing or generating', () => {
    expect(isCreateBusy(true, null, false)).toBe(false);
  });
  it('a take that landed holds the card until it is used or dismissed', () => {
    expect(isCreateBusy(true, null, false, true)).toBe(true);
  });
});

describe('the LANDED card (a Create take landed: open it in the Editor or the chat)', () => {
  const think = { label: 'THINKING', title: 'q', note: '', ai: true, failed: false };
  it('names the song and says where its first take is, plain', () => {
    expect(landedCard({ songId: 's1', title: 'Neon Harbor' })).toEqual({
      label: 'LANDED', title: 'Neon Harbor', note: 'the first take is in the Library · open it to edit, or talk it over', ai: false, failed: false,
    });
    expect(landedCard({ songId: 's1', title: '' }).title).toBe('Untitled');
  });
  it('ranks after writing and generating, before the held draft', () => {
    expect(createCardKind(think, true, true)).toBe('think');
    expect(createCardKind(null, true, true)).toBe('gen');
    expect(createCardKind(null, false, true)).toBe('landed');
    expect(createCardKind(null, false, false)).toBe('draft');
  });
});
