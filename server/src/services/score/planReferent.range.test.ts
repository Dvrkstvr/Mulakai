/** The mark as a `range` referent (F-055, D-175): its shape, and how it resolves against the playable version and
 * its parent: pinned, carried (seconds re-timed) or stale with or without a shift, never remapped. */
import { describe, it, expect } from 'vitest';
import { MARK_STALE, parseRange, rangeOutside, resolveRange, type RangeFacts } from './planReferent.js';
import type { RangeMark } from '../chat/analysisTypes.js';

const mark = (over: Partial<RangeMark> = {}): RangeMark => ({ kind: 'range', versionId: 'v3', bars: [5, 8], seconds: [8, 16], ...over });
const starts = Array.from({ length: 20 }, (_, i) => i * 2); // bar n starts at 2(n-1) s
const facts = (over: Partial<RangeFacts> = {}): RangeFacts => ({
  playable: { id: 'v3', number: 3 }, parent: { versionId: 'v2', number: 2, shift: { moved: false } }, bars: { starts, end: 40 }, ...over,
});

describe('parseRange', () => {
  it('absent or null is no mark: the whole song', () => {
    expect(parseRange(undefined)).toEqual({ ok: true, mark: null });
    expect(parseRange(null)).toEqual({ ok: true, mark: null });
  });
  it('keeps bars, seconds and a trimmed label', () => {
    expect(parseRange({ kind: 'range', versionId: 'v3', bars: [5, 8], seconds: [8, 16], label: '  CHORUS 2 ', extra: 1 }))
      .toEqual({ ok: true, mark: { kind: 'range', versionId: 'v3', bars: [5, 8], seconds: [8, 16], label: 'CHORUS 2' } });
  });
  it('a seconds-only mark has no bars', () => {
    expect(parseRange({ kind: 'range', versionId: 'v3', seconds: [1.5, 9] })).toEqual({ ok: true, mark: { kind: 'range', versionId: 'v3', seconds: [1.5, 9] } });
  });
  it.each([
    ['another kind', { kind: 'section', versionId: 'v3', seconds: [1, 2] }],
    ['no version', { kind: 'range', seconds: [1, 2] }],
    ['reversed seconds', { kind: 'range', versionId: 'v3', seconds: [9, 2] }],
    ['negative seconds', { kind: 'range', versionId: 'v3', seconds: [-1, 2] }],
    ['reversed bars', { kind: 'range', versionId: 'v3', bars: [8, 5], seconds: [1, 2] }],
    ['bar 0', { kind: 'range', versionId: 'v3', bars: [0, 5], seconds: [1, 2] }],
    ['a list', [1, 2]],
  ])('refuses %s', (_, v) => {
    expect(parseRange(v).ok).toBe(false);
  });
});

describe('resolveRange across a SET TEMPO (C1 code review should 2)', () => {
  const tempo = (over: Partial<RangeFacts> = {}) => facts({ parent: { versionId: 'v2', number: 2, shift: { moved: false, retimed: true } }, ...over });
  it('a seconds-only mark (0:30-0:45 on v2) is never carried: stale, read or not', () => {
    const m = mark({ versionId: 'v2', bars: undefined, seconds: [30, 45] });
    for (const f of [tempo({ bars: null }), tempo()]) {
      expect(resolveRange(m, f)).toEqual({ pinned: false, was: m, shift: null,
        reason: 'your mark was a time; v3 changed the tempo, so that time is different music now' });
    }
  });
  it("a bars mark before v3's bars are read is stale: its old seconds (0:10-0:20) are never sent", () => {
    const m = mark({ versionId: 'v2', bars: [5, 8], seconds: [10, 20] });
    expect(resolveRange(m, tempo({ bars: null }))).toEqual({ pinned: false, was: m, shift: null,
      reason: 'v3 changed the tempo and its bars are not read yet; mark again once its reading lands' });
  });
  it("a bars mark once v3's bars are read is carried, its seconds re-timed from them", () => {
    const r = resolveRange(mark({ versionId: 'v2', bars: [5, 8], seconds: [10, 20] }), tempo());
    expect(r).toEqual({ pinned: true, carried: true, mark: mark({ bars: [5, 8], seconds: [8, 16] }) });
  });
});

describe('resolveRange', () => {
  it('a mark on the playable version is pinned as sent', () => {
    expect(resolveRange(mark(), facts())).toEqual({ pinned: true, mark: mark(), carried: false });
  });
  it("a mark on the parent of a version that moved no bars is carried, its seconds re-timed from the new reading", () => {
    const r = resolveRange(mark({ versionId: 'v2' }), facts({ bars: { starts: starts.map((s) => s * 1.5), end: 60 } }));
    expect(r).toEqual({ pinned: true, carried: true, mark: mark({ versionId: 'v3', seconds: [12, 24] }) });
  });
  it('a carried mark keeps its seconds while the new version has no bar times', () => {
    expect(resolveRange(mark({ versionId: 'v2' }), facts({ bars: null }))).toEqual({ pinned: true, carried: true, mark: mark() });
  });
  it('a mark on the parent of a version that moved bars by a known shift is stale with that shift', () => {
    const shift = { atBar: 9, delta: -4 };
    const m = mark({ versionId: 'v2', bars: [10, 12] });
    const r = resolveRange(m, facts({ parent: { versionId: 'v2', number: 2, shift: { moved: true, shift } } }));
    expect(r).toEqual({ pinned: false, was: m, shift, reason: 'your mark was on v2; v3 moved those bars' });
  });
  it.each([
    ['holds a bar the CUT removed', [7, 10], { atBar: 9, delta: -4 }, null],
    ['is all removed', [5, 8], { atBar: 9, delta: -4 }, null],
    ['lies before the CUT', [1, 4], { atBar: 9, delta: -4 }, { atBar: 9, delta: -4 }],
    ['is split by a REPEAT', [7, 10], { atBar: 9, delta: 4 }, null],
    ['ends right before a REPEAT', [5, 8], { atBar: 9, delta: 4 }, { atBar: 9, delta: 4 }],
  ])('a mark that %s: shift %j', (_, bars, shift, want) => {
    const m = mark({ versionId: 'v2', bars: bars as [number, number] });
    expect(resolveRange(m, facts({ parent: { versionId: 'v2', number: 2, shift: { moved: true, shift } } }))).toMatchObject({ pinned: false, shift: want });
  });
  it('a seconds-only mark gets no shift (USE BARS needs bars)', () => {
    const m: RangeMark = { kind: 'range', versionId: 'v2', seconds: [1, 2] };
    expect(resolveRange(m, facts({ parent: { versionId: 'v2', number: 2, shift: { moved: true, shift: { atBar: 9, delta: 4 } } } }))).toMatchObject({ shift: null });
  });
  it('moved by an unknown amount: stale, no shift (no USE BARS)', () => {
    const r = resolveRange(mark({ versionId: 'v2' }), facts({ parent: { versionId: 'v2', number: 2, shift: { moved: true, shift: null } } }));
    expect(r).toMatchObject({ pinned: false, shift: null });
  });
  it('a mark on an older version than the parent is stale: never remapped', () => {
    expect(resolveRange(mark({ versionId: 'v1' }), facts())).toEqual({
      pinned: false, was: mark({ versionId: 'v1' }), shift: null, reason: 'your mark was on an older version; v3 is playing now',
    });
  });
  it('a seconds-only mark is carried as it is', () => {
    const m = mark({ versionId: 'v2', bars: undefined });
    delete m.bars;
    expect(resolveRange(m, facts())).toEqual({ pinned: true, carried: true, mark: { ...m, versionId: 'v3' } });
  });
  it('the code name the route answers with', () => expect(MARK_STALE).toBe('MARK_STALE'));
});

describe('resolveRange after a re-time of the reading (RT-5, F-092)', () => {
  const READ = '2026-10-08T01:00:00.000Z';
  const RETIMED = '2026-10-08T02:00:00.000Z';
  it('a bars mark counted on the reading before the re-time is stale, even where the bars still fit (RT-7)', () => {
    const r = resolveRange(mark({ readAt: READ }), facts({ readAt: RETIMED }));
    expect(r).toMatchObject({ pinned: false, shift: null, reason: "v3's reading was re-timed after you marked it, so every bar number changed; mark again" });
  });
  it('fits again once UNDO restores that reading', () => {
    expect(resolveRange(mark({ readAt: READ }), facts({ readAt: READ }))).toMatchObject({ pinned: true, carried: false });
  });
  it('a seconds-only mark and a mark from before marks carried a reading stay pinned: the audio did not change', () => {
    expect(resolveRange(mark({ bars: undefined }), facts({ readAt: RETIMED })).pinned).toBe(true);
    expect(resolveRange(mark(), facts({ readAt: RETIMED })).pinned).toBe(true);
  });
  it("a carried mark is counted on the new version's reading", () => {
    const r = resolveRange(mark({ versionId: 'v2', readAt: READ }), facts({ readAt: RETIMED }));
    expect(r).toMatchObject({ pinned: true, carried: true, mark: { versionId: 'v3', readAt: RETIMED } });
  });
  it('parseRange keeps readAt only on a bars mark', () => {
    expect(parseRange({ kind: 'range', versionId: 'v3', bars: [5, 8], seconds: [8, 16], readAt: READ })).toMatchObject({ mark: { readAt: READ } });
    expect(parseRange({ kind: 'range', versionId: 'v3', seconds: [8, 16], readAt: READ })).toEqual({ ok: true, mark: { kind: 'range', versionId: 'v3', seconds: [8, 16] } });
  });
});

describe('rangeOutside', () => {
  it('inside the song: nothing', () => expect(rangeOutside(mark(), { starts, end: 40 })).toBeNull());
  it('bars past the last bar', () => expect(rangeOutside(mark({ bars: [18, 22] }), { starts, end: 40 })).toBe('the mark reaches bar 22; the song has 20 bars'));
  it('seconds past the end', () => expect(rangeOutside(mark({ seconds: [30, 47] }), { starts, end: 40 })).toBe('the mark ends at 0:47; the song ends at 0:40'));
  it('without bar times only the shape is checked', () => expect(rangeOutside(mark({ bars: [90, 99] }), null)).toBeNull());
});
