/** Where each step of a version analysis comes from (F-052, D-174, D-182): the table. */
import { describe, it, expect } from 'vitest';
import { analysisPlan, analysisSources, type VersionFacts } from './analysisPlan.js';
import type { Services } from './readingPlan.js';

const all: Services = { lyrics: true, yue: true, acestep: true };
const none: Services = { lyrics: false, yue: false, acestep: false };
const yue2: VersionFacts = { ownScore: true, wordTimings: false, cachedGrid: false };
const ace: VersionFacts = { ownScore: false, wordTimings: false, cachedGrid: false };

describe('analysisPlan', () => {
  it('a YuE2 take: own score, words from lyrics-server, a chords run for the grid', () => {
    expect(analysisPlan(yue2, all)).toEqual({ words: { source: 'service' }, score: { source: 'own' }, sections: { source: 'track' } });
  });

  it('a spliced version runs no GPU step but WORDS: own score, cached grid', () => {
    expect(analysisSources(analysisPlan({ ...yue2, cachedGrid: true }, all))).toEqual({ words: 'service', score: 'own', sections: 'cached' });
  });

  it('stored word timings skip WORDS (D-182)', () => {
    expect(analysisPlan({ ...yue2, wordTimings: true, cachedGrid: true }, all).words).toEqual({ source: 'stored' });
    expect(analysisPlan({ ...yue2, wordTimings: true }, none).words).toEqual({ source: 'stored' });
  });

  it('an ACE-Step take: transcribed score, its grid from the same run', () => {
    expect(analysisSources(analysisPlan(ace, all))).toEqual({ words: 'service', score: 'service', sections: 'score' });
  });

  it('a cached grid wins over the transcription grid', () => {
    expect(analysisPlan({ ...ace, cachedGrid: true }, all).sections).toEqual({ source: 'cached' });
  });

  it('LYRICS_API_URL unset skips WORDS with the reason, not a failure (F-052 #4)', () => {
    expect(analysisPlan(yue2, { ...all, lyrics: false }).words).toEqual({ source: 'skip', why: 'word timings are off on this machine' });
  });

  it('no yue-server: no transcription and no bar times', () => {
    const plan = analysisPlan(ace, { ...all, yue: false });
    expect(plan.score).toEqual({ source: 'skip', why: 'score reading is off on this machine' });
    expect(plan.sections).toEqual({ source: 'skip', why: 'score reading is off on this machine' });
    expect(analysisPlan({ ...yue2, cachedGrid: true }, { ...all, yue: false }).sections)
      .toEqual({ source: 'skip', why: 'score reading is off on this machine' });
  });
});
