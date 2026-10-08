/** RE-TIME a chat reading (RT-5, F-092): the rebuilt score, its bars on the re-timed grid, UNDO, every refusal. */
import { describe, it, expect } from 'vitest';
import { RetimeRefused, type RetimeResult } from '../score/yueRetime.js';
import type { ScoreRead } from '../score/yueScoreRead.js';
import { readAnalysis, type VersionAnalysis } from './analysisTypes.js';
import { retimeReading, undoReadingRetime, type ReadingRetimeDeps } from './readingRetime.js';
import { retimeOffer } from './retimeRecord.js';

const facts = (bpm: number, bars: number) => ({
  header: { meter: '4/4', unit: '1/8', bpm, key: 'Am', bars, seconds: bars * 240 / bpm, units_per_quarter: 2 },
  key_notes: '', sections: [{ index: 1, label: 'verse', from_bar: 1, to_bar: bars }], lyric_blocks: [], bar_map: [],
});
const starts = (n: number, len: number) => Array.from({ length: n }, (_, i) => i * len);
const READ: VersionAnalysis = {
  analysis_v: 1, versionId: 'v1', readAt: '2026-10-08T01:00:00.000Z',
  plan: { words: 'service', score: 'service', sections: 'score' },
  words: { language: 'en', lines: ['a'], instrumental: false },
  score: { abc: 'X:1 read', source: 'transcribed', chords: true, facts: facts(140, 8), warnings: [], measure: null, notationId: 'n1' },
  bars: { source: 'tracked', offset: 0, starts: starts(8, 1.7), end: 13.6, agreement: 0.8 },
};
const RESULT: RetimeResult = {
  abc: 'X:1 half', measures: 4, bpm: 70, readBpm: 139.6, vocalNotes: 10, insNotes: 0, notes: 40, droppedNotes: 6, leftOut: [],
  downbeats: [0, 3.4, 6.8, 10.2, 13.6, 99], warnings: ['w'],
};

function deps(over: Partial<ReadingRetimeDeps> = {}): ReadingRetimeDeps & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  return {
    calls,
    load: async (id) => (id === 'n1' ? { files: { a: 'b' }, chords: true } : null),
    retime: async (...a) => { calls.push(['retime', ...a]); return RESULT; },
    readScore: async () => ({ ok: true, error: null, messages: ['m'], chordsPresent: true, tokens: 1, facts: facts(70, 4) }) as ScoreRead,
    measure: async () => null,
    readGrid: async () => ({ grid_v: 1, source: 'tracked', downbeats: starts(8, 1.7), chords: [[0, 13.6, 'A:min']], duration: 14 }),
    now: () => new Date('2026-10-08T02:00:00.000Z'),
    ...over,
  };
}

describe('retimeReading', () => {
  it('HALF: half the bars at the same seconds, bar i on re-timed downbeat i, kept with the reading as read', async () => {
    const d = deps();
    const out = await retimeReading(READ, { mode: 'half', bpm: null }, d);
    if (!out.ok) throw new Error(out.reason);
    const a = out.analysis;
    expect(d.calls[0]).toEqual(['retime', { files: { a: 'b' }, chords: true }, 'half', null]);
    // SheetSage2 built the score from this beat list: no fit, so no offset (a fit put a real song's bar 1 17 s late).
    expect(a.bars).toEqual({ source: 'cached', offset: 0, starts: [0, 3.4, 6.8, 10.2], end: 13.6, agreement: null });
    expect(a.score).toMatchObject({ abc: 'X:1 half', source: 'transcribed', notationId: 'n1', warnings: ['w', 'm'] });
    expect(a.readAt).toBe('2026-10-08T02:00:00.000Z'); // a new reading: a mark on the old bars no longer fits
    expect(a.retime).toMatchObject({ mode: 'half', bpm: 70, fromBpm: 140, fromBars: 8, toBars: 4, droppedNotes: 6, notes: 40 });
    expect(a.retime!.previous).toEqual({ readAt: READ.readAt, score: READ.score, bars: READ.bars });
  });

  it('a re-time of a re-time starts from the reading, and UNDO goes back to it in one step (D-231)', async () => {
    const half = await retimeReading(READ, { mode: 'half', bpm: null }, deps());
    if (!half.ok) throw new Error(half.reason);
    const d = deps();
    const again = await retimeReading(half.analysis, { mode: 'bpm', bpm: 92 }, d);
    if (!again.ok) throw new Error(again.reason);
    expect(d.calls[0]).toEqual(['retime', expect.anything(), 'bpm', 92]);
    expect(again.analysis.retime).toMatchObject({ mode: 'bpm', fromBpm: 140, fromBars: 8 });
    expect(again.analysis.retime!.previous.readAt).toBe(READ.readAt);
    expect(undoReadingRetime(again.analysis)).toEqual(READ);
  });

  it('survives the stored blob: the record is read back, a broken one is no record', async () => {
    const out = await retimeReading(READ, { mode: 'double', bpm: null }, deps());
    if (!out.ok) throw new Error(out.reason);
    const back = readAnalysis(JSON.stringify(out.analysis));
    expect(back).toEqual(out.analysis);
    const broken = readAnalysis(JSON.stringify({ ...out.analysis, retime: { ...out.analysis.retime, previous: { readAt: 1 } } }));
    expect(broken && 'retime' in broken ? broken.retime : 'none').toBeUndefined();
  });

  it.each([
    ['a YuE2 song\'s own score', { ...READ, score: { ...READ.score, source: 'own' } }, 409, 'not_retimable'],
    ['no reading', null, 409, 'not_retimable'],
    ['no bar times', { ...READ, bars: { notRead: 'x' } }, 409, 'not_retimable'],
    ['a reading with no kept bundle', { ...READ, score: { ...READ.score, notationId: null } }, 422, 'no_bundle'],
    ['a bundle that was swept', { ...READ, score: { ...READ.score, notationId: 'gone' } }, 422, 'no_bundle'],
  ])('refuses %s, changing nothing', async (_, stored, status, code) => {
    const out = await retimeReading(stored as VersionAnalysis | null, { mode: 'half', bpm: null }, deps());
    expect(out).toMatchObject({ ok: false, status, code });
  });

  it("times only the bars the audio holds: the grid's duration, else the reading's own end", async () => {
    const long = deps({ readScore: async () => ({ ok: true, error: null, messages: [], chordsPresent: true, tokens: 1, facts: facts(70, 6) }) as ScoreRead });
    const out = await retimeReading(READ, { mode: 'half', bpm: null }, long);
    expect(out.ok && out.analysis.bars).toMatchObject({ starts: [0, 3.4, 6.8, 10.2, 13.6], end: 14 }); // bar 6 (at 99 s) is past the audio
    const lost = await retimeReading(READ, { mode: 'half', bpm: null }, deps({ readGrid: async () => null }));
    expect(lost.ok && lost.analysis.bars).toMatchObject({ starts: [0, 3.4, 6.8, 10.2], end: 13.6 });
  });

  it("passes yue-server's refusal, a down engine and an empty beat list through", async () => {
    const refused = deps({ retime: async () => { throw new RetimeRefused('out_of_range', '300 BPM is outside 40-240'); } });
    expect(await retimeReading(READ, { mode: 'bpm', bpm: 300 }, refused)).toMatchObject({ status: 422, code: 'out_of_range' });
    const down = deps({ retime: async () => { throw new Error('fetch failed'); } });
    expect(await retimeReading(READ, { mode: 'half', bpm: null }, down)).toMatchObject({ status: 502 });
    const none = deps({ retime: async () => ({ ...RESULT, downbeats: [] }) });
    expect(await retimeReading(READ, { mode: 'half', bpm: null }, none)).toMatchObject({ status: 422, code: 'bars' });
  });
});

describe('retimeOffer', () => {
  it('is offered on a transcribed reading with the facts as read, never on an own score', () => {
    expect(retimeOffer(READ.score, undefined)).toEqual({ notationId: 'n1', read: { bpm: 140, bars: 8 }, retimed: null });
    expect(retimeOffer({ ...READ.score, source: 'own' } as VersionAnalysis['score'], undefined)).toBeNull();
    expect(retimeOffer({ notRead: 'x' }, undefined)).toBeNull();
  });

  it('a re-timed reading still reads as SheetSage2 read it, with the re-time beside it', async () => {
    const out = await retimeReading(READ, { mode: 'half', bpm: null }, deps());
    if (!out.ok) throw new Error(out.reason);
    expect(retimeOffer(out.analysis.score, out.analysis.retime)).toMatchObject({ read: { bpm: 140, bars: 8 }, retimed: { mode: 'half', bpm: 70, toBars: 4 } });
  });
});

describe('undoReadingRetime', () => {
  it('is null when nothing was re-timed', () => {
    expect(undoReadingRetime(READ)).toBeNull();
    expect(undoReadingRetime(null)).toBeNull();
  });
});
