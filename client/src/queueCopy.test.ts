import { describe, it, expect } from 'vitest';
import { queuedLine, queuedTitle, startsAfter } from './queueCopy';

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
