import { describe, expect, it } from 'vitest';
import { jobDoing, songActivity } from './continueActivity';

const repaint = { kind: 'repaint' as const, songId: 's1', layer: 'Base', label: 'repaint 1:02–1:31' };

describe('jobDoing (a queued job in words)', () => {
  it('names the verb, the part and the layer', () => {
    expect(jobDoing(repaint)).toBe('repainting 1:02–1:31 · BASE');
    expect(jobDoing({ kind: 'regenerate', layer: 'Base', label: 'alt 0:10–0:20' })).toBe('rerolling 0:10–0:20 · BASE');
    expect(jobDoing({ kind: 'retake', layer: 'Vocals', label: 'similar: first generation' })).toBe('more like first generation · VOCALS');
    expect(jobDoing({ kind: 'addLayer', layer: 'Backing vocals', label: 'add Backing vocals' })).toBe('adding backing vocals');
    expect(jobDoing({ kind: 'split', layer: 'Base', label: 'split ace-step' })).toBe('splitting · BASE');
    expect(jobDoing({ kind: 'remaster', label: 'remaster the mix' })).toBe('remastering the mix');
  });

  it('a brief helper is not work on the song', () => {
    expect(jobDoing({ kind: 'plan', label: 'help' })).toBeNull();
    expect(jobDoing({ kind: 'timings', label: 'word timings' })).toBeNull();
  });
});

describe('songActivity (what a CONTINUE card says is still open)', () => {
  it("the song's running job, then its queued ones, not another song's", () => {
    const queued = [
      { kind: 'addLayer' as const, songId: 's1', layer: 'Strings', label: 'add Strings' },
      { ...repaint, songId: 's2' },
    ];
    expect(songActivity('s1', repaint, queued, null)).toEqual(['repainting 1:02–1:31 · BASE', 'adding strings · queued']);
  });

  it('a settled split with stems not kept', () => {
    const split = {
      songId: 's1', stage: 'done' as const,
      stems: [{ status: 'done' as const }, { status: 'done' as const, claimed: 'added' as const }, { status: 'done' as const }, { status: 'done' as const }],
    };
    expect(songActivity('s1', null, [], split)).toEqual(['3 stems unkept']);
    expect(songActivity('s2', null, [], split)).toEqual([]);
  });

  it('nothing for a split still extracting (its queue job says so) or with every stem kept', () => {
    const stems = [{ status: 'done' as const, claimed: 'replaced' as const }];
    expect(songActivity('s1', null, [], { songId: 's1', stage: 'done', stems })).toEqual([]);
    expect(songActivity('s1', null, [], { songId: 's1', stage: 'running', stems: [{ status: 'running' }] })).toEqual([]);
  });

  it('one stem reads singular', () => {
    expect(songActivity('s1', null, [], { songId: 's1', stage: 'done', stems: [{ status: 'done' }] })).toEqual(['1 stem unkept']);
  });
});
