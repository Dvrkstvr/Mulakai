import { describe, it, expect } from 'vitest';
import { queuedLine, queuedTitle, queueSuffix, startsAfter } from './queueCopy';
import { selectJobsAhead } from './queueStore';

describe("a commit's consequence line", () => {
  it('says when the job starts while the queue is busy, and nothing when it would start at once', () => {
    expect(queueSuffix(0)).toBe('');
    expect(queueSuffix(1)).toBe(' · starts after 1 job');
    expect(queueSuffix(3)).toBe(' · starts after 3 jobs');
  });

  it('counts the running job and every queued one ahead of a new commit', () => {
    const running = { kind: 'generate' as const, jobId: 'g', startedAt: 1 };
    const queued = { kind: 'repaint' as const, jobId: 'r', position: 1, queuedAt: 1 };
    expect(selectJobsAhead({ running: null, queued: [] })).toBe(0);
    expect(selectJobsAhead({ running, queued: [] })).toBe(1);
    expect(selectJobsAhead({ running, queued: [queued, { ...queued, jobId: 'r2', position: 2 }] })).toBe(3);
  });
});

describe('queue copy', () => {
  it('counts the jobs a queued one waits for', () => {
    expect(startsAfter(1)).toBe('starts after 1 job');
    expect(startsAfter(2)).toBe('starts after 2 jobs');
    expect(startsAfter(0)).toBe('starts now');
  });

  it("names what the job does from the server's label, or its kind", () => {
    expect(queuedLine({ kind: 'repaint', label: 'repaint 1:32–2:07', position: 1 })).toBe('REPAINT 1:32–2:07 · starts after 1 job');
    expect(queuedLine({ kind: 'generate', position: 3 })).toBe('GENERATE · starts after 3 jobs');
    expect(queuedLine({ kind: 'analyze', position: 2 })).toBe('ANALYZE AUDIO · starts after 2 jobs');
  });

  it('titles the row by song, then layer', () => {
    expect(queuedTitle({ title: 'Copper Sky', layer: 'Vocals' })).toBe('Copper Sky · vocals');
    expect(queuedTitle({}, 'From the index')).toBe('From the index');
    expect(queuedTitle({})).toBe('Untitled');
  });
});
