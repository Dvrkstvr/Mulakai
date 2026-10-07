/** The version analysis's steps over stubs (F-052, D-174, D-182): each source, each step failing alone, the
 * spliced version that runs no GPU step but WORDS, and the progress text the reading line reads. */
import { describe, it, expect, vi } from 'vitest';
import { analysisPlan, type VersionFacts } from './analysisPlan.js';
import { analyzeSteps, type AnalysisInput, type AnalysisStepDeps } from './analysisSteps.js';
import type { Grid } from './gridCache.js';

const FACTS = {
  header: { meter: '4/4', unit: '1/32', bpm: 120, key: 'C', bars: 8, seconds: 16, units_per_quarter: 8 },
  key_notes: '', sections: [{ index: 1, label: 'verse', from_bar: 1, to_bar: 4 }], lyric_blocks: [], bar_map: [],
};
const GRID: Grid = { grid_v: 1, source: 'tracked', downbeats: [0.3, 2.3], chords: [], duration: 4 };
const BARS = { offset: 0, starts: [0.3, 2.3], end: 4.3, agreement: 1 };
const OUTCOME = {
  warnings: [], measures: 2, vocalNotes: 1, instrumentalNotes: 1, durationSeconds: 4, hasPreview: false, sectionStarts: null,
  score: 'X:1\n% verse\n', sourceLabel: 'S', yueJobId: 'tr-0001',
};
const READING = { language: 'en', segments: [{ text: ' Hey you ', start: 0, end: 1, words: [] }, { text: '', start: 1, end: 2, words: [] }] };
const ALL = { lyrics: true, yue: true, acestep: false };

function deps(over: Partial<AnalysisStepDeps> = {}): AnalysisStepDeps {
  return {
    lyrics: vi.fn(async () => READING),
    transcribe: vi.fn(async (_a, _f, onProgress) => { onProgress(0.41); return OUTCOME; }),
    readScore: vi.fn(async () => ({ ok: true, error: null, messages: [], chordsPresent: true, bpm: 120, seconds: 16, tokens: 9, facts: FACTS })),
    measure: vi.fn(async () => null),
    grid: vi.fn(async () => ({ ...GRID })),
    bars: vi.fn(async (_abc, _grid, source) => ({ ok: true as const, bars: { source, ...BARS } })),
    readGrid: vi.fn(async () => ({ ...GRID, source: 'mapped' })),
    writeGrid: vi.fn(async () => true),
    ...over,
  };
}

function input(facts: Partial<VersionFacts>, seen: string[] = [], over: Partial<AnalysisInput> = {}): AnalysisInput {
  const v: VersionFacts = { ownScore: false, wordTimings: false, cachedGrid: false, ...facts };
  return {
    versionId: 'v1', audio: Buffer.from('a'), filename: 'v1.flac', own: v.ownScore ? { abc: 'X:1\nown\n', lyrics: '[verse]\nHey' } : null,
    storedWords: v.wordTimings ? READING : null, plan: analysisPlan(v, ALL), signal: new AbortController().signal,
    progress: (t) => seen.push(t), ...over,
  };
}
const noop = () => {};

describe('analyzeSteps', () => {
  it('a spliced YuE2 version: its own score and the cached mapped grid, so no GPU step but WORDS', async () => {
    const d = deps();
    const out = await analyzeSteps(input({ ownScore: true, cachedGrid: true }), d, noop);
    expect(d.lyrics).toHaveBeenCalledTimes(1);
    expect(d.transcribe).not.toHaveBeenCalled();
    expect(out.words).toEqual({ language: 'en', lines: ['Hey you'], instrumental: false });
    expect(out.timings).toEqual(READING);
    expect(out.score).toMatchObject({ abc: 'X:1\nown\n', source: 'own', facts: FACTS });
    expect(d.readScore).toHaveBeenCalledWith('X:1\nown\n', '[verse]\nHey');
    expect(out.bars).toEqual({ source: 'mapped', ...BARS });
    expect(d.bars).toHaveBeenCalledWith('X:1\nown\n', { ...GRID, source: 'mapped' }, 'mapped');
    expect(d.writeGrid).not.toHaveBeenCalled();
  });

  it('stored word timings skip lyrics-server and are not written again (D-182)', async () => {
    const d = deps();
    const out = await analyzeSteps(input({ ownScore: true, wordTimings: true, cachedGrid: true }), d, noop);
    expect(d.lyrics).not.toHaveBeenCalled();
    expect(out.words).toEqual({ language: 'en', lines: ['Hey you'], instrumental: false });
    expect(out.timings).toBeNull();
  });

  it('a non-YuE2 version: one chords run gives the transcribed score and the grid, cached for the splice', async () => {
    const d = deps();
    const seen: string[] = [];
    const out = await analyzeSteps(input({}, seen), d, noop);
    expect(d.transcribe).toHaveBeenCalledTimes(1);
    expect(out.score).toMatchObject({ abc: OUTCOME.score, source: 'transcribed' });
    expect(d.grid).toHaveBeenCalledWith('tr-0001');
    expect(d.writeGrid).toHaveBeenCalledWith('v1', GRID);
    expect(out.bars).toEqual({ source: 'tracked', ...BARS });
    expect(seen).toEqual(expect.arrayContaining(['WORDS', 'WORDS · lyrics-server', 'SCORE', 'SCORE · transcribing 41%', 'SECTIONS', 'SECTIONS · timing the bars']));
    expect(seen.indexOf('WORDS')).toBeLessThan(seen.indexOf('SCORE'));
    expect(seen.indexOf('SCORE')).toBeLessThan(seen.indexOf('SECTIONS'));
  });

  it('a YuE2 version with no cached grid tracks the beat alone and caches it', async () => {
    const d = deps();
    const seen: string[] = [];
    const out = await analyzeSteps(input({ ownScore: true }, seen), d, noop);
    expect(d.transcribe).toHaveBeenCalledTimes(1);
    expect(seen).toContain('SECTIONS · tracking the beat 41%');
    expect(d.writeGrid).toHaveBeenCalledWith('v1', GRID);
    expect(out.bars).toEqual({ source: 'tracked', ...BARS });
  });

  it('each step failing alone is not read, never a throw; the others still read', async () => {
    const words = await analyzeSteps(input({ ownScore: true, cachedGrid: true }), deps({ lyrics: vi.fn(async () => { throw new Error('lyrics-server is down'); }) }), noop);
    expect(words).toMatchObject({ words: { notRead: 'lyrics-server is down' }, timings: null, score: { source: 'own' }, bars: { source: 'mapped' } });

    const score = await analyzeSteps(input({}), deps({ transcribe: vi.fn(async () => { throw new Error('SheetSage2 failed'); }) }), noop);
    expect(score.score).toEqual({ notRead: 'SheetSage2 failed' });
    expect(score.bars).toEqual({ notRead: 'the score step ran no transcription to take the beat from' });
    expect(score.words).toMatchObject({ lines: ['Hey you'] });

    const bars = await analyzeSteps(input({ ownScore: true, cachedGrid: true }), deps({ bars: vi.fn(async () => ({ ok: false as const, reason: 'YUE2 could not time the bars: the score has no bars' })) }), noop);
    expect(bars).toMatchObject({ score: { source: 'own' }, bars: { notRead: 'YUE2 could not time the bars: the score has no bars' } });

    const noGrid = await analyzeSteps(input({}), deps({ grid: vi.fn(async () => null) }), noop);
    expect(noGrid.bars).toEqual({ notRead: 'the transcription kept no downbeat grid' });
    const gone = await analyzeSteps(input({ ownScore: true, cachedGrid: true }), deps({ readGrid: vi.fn(async () => null) }), noop);
    expect(gone.bars).toEqual({ notRead: 'the cached grid is gone' });
    const thrown = await analyzeSteps(input({ ownScore: true, cachedGrid: true }), deps({ bars: vi.fn(async () => { throw new Error('YUE2 bar times -> ECONNREFUSED'); }) }), noop);
    expect(thrown.bars).toEqual({ notRead: 'YUE2 bar times -> ECONNREFUSED' });
  });

  it('unset services skip with the reason (not a failure, F-052 #4); no score means no bars', async () => {
    const plan = analysisPlan({ ownScore: false, wordTimings: false, cachedGrid: false }, { lyrics: false, yue: false, acestep: false });
    const d = deps();
    const out = await analyzeSteps(input({}, [], { plan }), d, noop);
    expect(out).toEqual({ words: { notRead: 'LYRICS_API_URL is not set' }, timings: null, score: { notRead: 'YUE_API_URL is not set' }, bars: { notRead: 'YUE_API_URL is not set' } });
    expect(d.lyrics).not.toHaveBeenCalled();
    expect(d.transcribe).not.toHaveBeenCalled();
  });

  it('a cancel between steps stops the run', async () => {
    const d = deps();
    let n = 0;
    await expect(analyzeSteps(input({}), d, () => { if (++n === 2) throw new Error('Aborted'); })).rejects.toThrow('Aborted');
    expect(d.lyrics).toHaveBeenCalledTimes(1);
    expect(d.transcribe).not.toHaveBeenCalled();
  });
});
