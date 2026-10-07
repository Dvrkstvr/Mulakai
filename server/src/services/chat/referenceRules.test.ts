/** What a reference upload must be, the 360 s read span (D-138) and the READ card's GPU estimate (F-061). */
import { describe, it, expect } from 'vitest';
import { READ_LIMIT_S, readingEstimate, readSpan, referenceExt, uploadProblem } from './referenceRules.js';

describe('referenceExt', () => {
  it('keeps a known audio extension, lower-cased', () => {
    expect(referenceExt('My Song.MP3')).toBe('mp3');
    expect(referenceExt('take.flac')).toBe('flac');
  });
  it('null for anything else', () => {
    expect(referenceExt('notes.txt')).toBeNull();
    expect(referenceExt('noext')).toBeNull();
    expect(referenceExt('')).toBeNull();
  });
});

describe('uploadProblem', () => {
  const ok = { filename: 'a.wav', bytes: 1000, seconds: 12.5, maxMb: 300 };
  it('null for a readable audio file', () => expect(uploadProblem(ok)).toBeNull());
  it('not an audio file by its name', () => {
    expect(uploadProblem({ ...ok, filename: 'notes.txt' })).toBe('notes.txt is not an audio file (MP3, WAV, FLAC, OGG, M4A, AAC, OPUS, AIFF, WEBM)');
  });
  it('empty, too big, or no readable length', () => {
    expect(uploadProblem({ ...ok, bytes: 0 })).toBe('a.wav is empty');
    expect(uploadProblem({ ...ok, bytes: 301 * 1024 * 1024 })).toBe('a.wav is over 300 MB');
    expect(uploadProblem({ ...ok, seconds: null })).toBe('a.wav could not be read as audio: is it a broken or non-audio file?');
    expect(uploadProblem({ ...ok, seconds: 0 })).toBe('a.wav could not be read as audio: is it a broken or non-audio file?');
  });
});

describe('readSpan (D-138)', () => {
  it('reads all of a file up to 360 s', () => {
    expect(readSpan(200)).toEqual({ to: 200, cut: false });
    expect(readSpan(READ_LIMIT_S)).toEqual({ to: 360, cut: false });
  });
  it('a longer file reads the first 360 s and says so', () => expect(readSpan(467.2)).toEqual({ to: 360, cut: true }));
  it('an unknown length reads up to the limit, not cut', () => expect(readSpan(null)).toEqual({ to: 360, cut: false }));
});

describe('readingEstimate', () => {
  it('a service step costs GPU seconds by length; own and skipped steps cost nothing', () => {
    const all = readingEstimate({ words: 'service', score: 'service', caption: 'service' }, 200);
    expect(all.words).toBeGreaterThan(0);
    expect(all.score).toBeGreaterThan(all.words);
    expect(all.total).toBe(all.words + all.score + all.caption);
    expect(readingEstimate({ words: 'own', score: 'own', caption: 'skip' }, 200)).toEqual({ words: 0, score: 0, caption: 0, total: 0 });
  });
  it('grows with length, capped at the read span', () => {
    const plan = { words: 'service', score: 'service', caption: 'service' } as const;
    expect(readingEstimate(plan, 300).total).toBeGreaterThan(readingEstimate(plan, 100).total);
    expect(readingEstimate(plan, 900)).toEqual(readingEstimate(plan, 360));
  });
});
