import { describe, it, expect } from 'vitest';
import { planSources, readingPlan, SKIP } from './readingPlan.js';
import type { OwnSnapshot } from './referenceStore.js';

const all = { lyrics: true, yue: true, acestep: true };
const own = (over: Partial<OwnSnapshot> = {}): OwnSnapshot => ({
  own_v: 1, abc: 'X:1\nK:C\n', lyrics: '[Verse]\nla la', caption: 'pop, piano', bpm: 120, key: 'C major', meter: '4/4',
  engine: 'yue2', layers: 1, ...over,
});

describe('readingPlan', () => {
  it('an upload reads every part on its service', () => {
    expect(planSources(readingPlan(null, all))).toEqual({ words: 'service', score: 'service', caption: 'service' });
  });

  it('a YuE2 library song reads its own score, words and caption: no GPU', () => {
    expect(planSources(readingPlan(own(), { lyrics: false, yue: false, acestep: false })))
      .toEqual({ words: 'own', score: 'own', caption: 'own' });
  });

  it('another library song keeps its own words and caption and has its score transcribed', () => {
    const plan = readingPlan(own({ abc: null, engine: null }), all);
    expect(planSources(plan)).toEqual({ words: 'own', score: 'service', caption: 'own' });
  });

  it('a library song with no words or caption of its own reads them on the services', () => {
    expect(planSources(readingPlan(own({ lyrics: null, caption: null }), all))).toEqual({ words: 'service', score: 'own', caption: 'service' });
    expect(planSources(readingPlan(own({ lyrics: '  ', caption: '' }), all)).words).toBe('service');
  });

  it('a service that is unset or down skips its step and says why', () => {
    const plan = readingPlan(null, { lyrics: false, yue: false, acestep: false });
    expect(plan.words).toEqual({ source: 'skip', why: SKIP.words });
    expect(plan.score).toEqual({ source: 'skip', why: SKIP.score });
    expect(plan.caption).toEqual({ source: 'skip', why: SKIP.caption });
    expect(SKIP.words).toBe('word timings are off on this machine'); // C2 live B6: shown in the panel, no env var names
    expect(SKIP.score).toBe('score reading is off on this machine');
    expect(SKIP.caption).toBe('ACE-Step is not running');
  });
});
