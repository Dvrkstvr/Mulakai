/** readAnalysis from raw blobs (architecture.md "Test strategy (C1)" #3): v1, the failed record, an unknown
 * version and garbage; a broken part alone reads as not read (versions-data.md's rule). */
import { describe, it, expect } from 'vitest';
import { ANALYSIS_V, isFailed, readAnalysis, type VersionAnalysis } from './analysisTypes.js';

const v1: VersionAnalysis = {
  analysis_v: 1, versionId: 'v4', readAt: '2026-10-07T10:00:00.000Z',
  plan: { words: 'service', score: 'own', sections: 'cached' },
  words: { language: 'en', lines: ['hey you'], instrumental: false },
  score: { abc: 'X:1\nK:C\n', source: 'own', chords: true, facts: null, warnings: [], measure: null },
  bars: { source: 'cached', offset: 0, starts: [0, 2, 4], end: 6, agreement: 0.9 },
};

describe('readAnalysis', () => {
  it('reads a v1 analysis whole', () => {
    expect(ANALYSIS_V).toBe(1);
    expect(readAnalysis(JSON.stringify(v1))).toEqual(v1);
  });

  it('reads the failed record, so FAILED + RETRY survive a reload (D-179)', () => {
    const failed = { analysis_v: 1, versionId: 'v4', failed: 'the audio file is missing', at: '2026-10-07T10:00:00.000Z' };
    const read = readAnalysis(JSON.stringify(failed));
    expect(read).toEqual(failed);
    expect(read && isFailed(read)).toBe(true);
    expect(isFailed(v1)).toBe(false);
  });

  it('keeps a part that was not read, with its reason', () => {
    const blob = { ...v1, words: { notRead: 'LYRICS_API_URL is not set' }, bars: { notRead: 'no grid' } };
    expect(readAnalysis(JSON.stringify(blob))).toMatchObject({ words: { notRead: 'LYRICS_API_URL is not set' }, bars: { notRead: 'no grid' } });
  });

  it('reads a broken part alone as not read, keeping the rest', () => {
    const blob = { ...v1, score: { abc: 3 }, bars: { source: 'cached', offset: 0, starts: ['x'], end: 6, agreement: null } };
    const read = readAnalysis(JSON.stringify(blob)) as VersionAnalysis;
    expect(read.words).toEqual(v1.words);
    expect('notRead' in read.score && read.score.notRead).toMatch(/read again/);
    expect('notRead' in read.bars && read.bars.notRead).toMatch(/read again/);
  });

  it('accepts a null agreement (yue-server reports NaN as null)', () => {
    const blob = { ...v1, bars: { ...v1.bars, agreement: null } };
    expect((readAnalysis(JSON.stringify(blob)) as VersionAnalysis).bars).toMatchObject({ agreement: null });
  });

  it('reads nothing stored, an unknown version and garbage as not analyzed', () => {
    expect(readAnalysis(null)).toBeNull();
    expect(readAnalysis('')).toBeNull();
    expect(readAnalysis(JSON.stringify({ ...v1, analysis_v: 2 }))).toBeNull();
    expect(readAnalysis('{not json')).toBeNull();
    expect(readAnalysis('[]')).toBeNull();
    expect(readAnalysis(JSON.stringify({ ...v1, versionId: 7 }))).toBeNull();
    expect(readAnalysis(JSON.stringify({ ...v1, plan: { words: 'own', score: 'own', sections: 'cached' } }))).toBeNull();
    expect(readAnalysis(JSON.stringify({ analysis_v: 1, versionId: 'v4', failed: 5, at: 'x' }))).toBeNull();
  });
});
