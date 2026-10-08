/** The mark's geometry (F-054, CS-5) and `markStale` (F-055, CS-11): snaps, Alt, clamps at the song's ends, section
 * click, edge drag, body move, seconds only on a hatched strip and snapped once bars land, and every stale case. */
import { describe, it, expect } from 'vitest';
import {
  barAt, dragEdge, landBars, markBars, markSeconds, markSection, markStale, moveBody, shiftedBars, snapTime, usableBars,
} from './chatMark';
import type { ShownReading } from './api/chatAnalysis';
import { DURATION, READING, SECTIONS, v5, view } from './chatMarkFixture';

const BARS = READING.bars!;

describe('snap and bars', () => {
  it('snaps to the nearest bar line; Alt (free) keeps the time; no bars keeps it', () => {
    expect(snapTime(4.2, BARS)).toEqual({ t: 5, line: 3 });
    expect(snapTime(3.9, BARS)).toEqual({ t: 3, line: 2 });
    expect(snapTime(40, BARS)).toEqual({ t: 33, line: 17 }); // the end line
    expect(snapTime(4.2, BARS, true)).toEqual({ t: 4.2, line: null });
    expect(snapTime(4.2, null)).toEqual({ t: 4.2, line: null });
  });

  it('finds the bar holding a time, clamped to the bars', () => {
    expect(barAt(BARS, 0)).toBe(1);
    expect(barAt(BARS, 6.5)).toBe(3);
    expect(barAt(BARS, 99)).toBe(16);
  });

  it('a hatched or missing reading gives no bars to snap to', () => {
    expect(usableBars(view())).toBe(BARS);
    expect(usableBars(view({ shown: { ...READING, mode: 'dim' } }))).toBe(BARS);
    expect(usableBars(view({ shown: { ...READING, mode: 'hatched' } }))).toBeNull();
    expect(usableBars(view({ shown: null }))).toBeNull();
  });
});

describe('gestures', () => {
  it('click a section: its bars and seconds', () => {
    expect(markSection(view(), SECTIONS[2])).toEqual({ kind: 'range', versionId: 'v4', bars: [7, 10], seconds: [13, 21], readAt: READING.readAt });
  });

  it('a drag on the waveform snaps both edges to bar lines; reversed drags read the same', () => {
    const m = { kind: 'range', versionId: 'v4', bars: [3, 6], seconds: [5, 13], readAt: READING.readAt };
    expect(markSeconds(view(), 5.3, 12.6)).toEqual(m);
    expect(markSeconds(view(), 12.6, 5.3)).toEqual(m);
  });

  it('a drag inside one bar marks that bar; a click is no mark', () => {
    expect(markSeconds(view(), 5.4, 6.4)?.bars).toEqual([3, 3]);
    expect(markSeconds(view(), 6, 6.1)).toBeNull();
  });

  it('a short drag across a bar line marks the bar holding its middle, not the one it starts in (R-041)', () => {
    expect(markSeconds(view(), 6.8, 7.6)?.bars).toEqual([4, 4]);
    expect(markSeconds(view(), 6.4, 7.4)?.bars).toEqual([3, 3]);
  });

  it('Alt frees the edges: exact seconds, the bars it touches', () => {
    expect(markSeconds(view(), 5.5, 12.5, true)).toEqual({ kind: 'range', versionId: 'v4', bars: [3, 6], seconds: [5.5, 12.5], readAt: READING.readAt });
  });

  it('a mark cannot pass the song’s ends', () => {
    expect(markSeconds(view(), -4, 3)).toEqual({ kind: 'range', versionId: 'v4', bars: [1, 1], seconds: [1, 3], readAt: READING.readAt });
    expect(markSeconds(view(), 29, 60)).toEqual({ kind: 'range', versionId: 'v4', bars: [15, 16], seconds: [29, 33], readAt: READING.readAt });
    expect(markSeconds(view({ shown: null }), 30, 60, false, DURATION)).toEqual({ kind: 'range', versionId: 'v4', seconds: [30, 34] });
    expect(markBars(view(), 0, 40)).toEqual({ kind: 'range', versionId: 'v4', bars: [1, 16], seconds: [1, 33], readAt: READING.readAt });
  });

  it('drag an edge: extends, and crossing the other edge swaps them', () => {
    const m = markSection(view(), SECTIONS[2])!; // bars 7-10
    expect(dragEdge(view(), m, 'end', 24.8)?.bars).toEqual([7, 12]);
    expect(dragEdge(view(), m, 'start', 9.2)?.bars).toEqual([5, 10]);
    expect(dragEdge(view(), m, 'end', 9.2)?.bars).toEqual([5, 6]);
  });

  it('drag the body: whole bars, same length, stopped at the ends', () => {
    const m = markSection(view(), SECTIONS[2])!; // bars 7-10, 13-21 s
    expect(moveBody(view(), m, 4.3)?.bars).toEqual([9, 12]);
    expect(moveBody(view(), m, 40)?.bars).toEqual([13, 16]);
    expect(moveBody(view(), m, -40)?.bars).toEqual([1, 4]);
  });

  it('on a hatched strip a mark is seconds only, moves by time and stays inside the song', () => {
    const hatched = view({ shown: { ...READING, mode: 'hatched', bars: null } });
    const m = markSeconds(hatched, 10.3, 14.7)!;
    expect(m).toEqual({ kind: 'range', versionId: 'v4', seconds: [10.3, 14.7] });
    const [a, b] = moveBody(hatched, m, 100, false, DURATION)!.seconds;
    expect([a, b]).toEqual([expect.closeTo(29.6), 34]);
  });

  it('a seconds-only mark snaps to bars when the reading lands', () => {
    const m = markSeconds(view({ shown: null }), 5.3, 12.6)!;
    expect(m.bars).toBeUndefined();
    expect(landBars(view(), m)).toEqual({ kind: 'range', versionId: 'v4', bars: [3, 6], seconds: [5, 13], readAt: READING.readAt });
    expect(landBars(view({ shown: null }), m)).toBe(m);
  });
});

describe('markStale after a re-time of the reading (RT-5, F-092)', () => {
  const RETIMED = { ...READING, readAt: '2026-10-08T02:00:00Z', bars: { starts: READING.bars!.starts.filter((_, i) => i % 2 === 0), end: 33 } };

  it('a bars mark counted on the old reading is stale even where its bars still fit (RT-7); UNDO makes it valid again', () => {
    const m = markBars(view(), 3, 4)!;
    expect(m.readAt).toBe(READING.readAt);
    expect(markStale(m, view({ shown: RETIMED }))).toEqual({ kind: 'stale', useBars: null, reading: true });
    expect(markStale(m, view())).toEqual({ kind: 'valid' });
  });

  it('a seconds-only mark, a mark from before marks were stamped, and a dimmed reading are not counted', () => {
    expect(markStale({ kind: 'range', versionId: 'v4', seconds: [5, 9] }, view({ shown: RETIMED })).kind).toBe('valid');
    expect(markStale({ kind: 'range', versionId: 'v4', bars: [3, 4], seconds: [5, 9] }, view({ shown: RETIMED })).kind).toBe('valid');
    expect(markBars(v5(false, null, { ...READING, mode: 'dim' }), 3, 4)?.readAt).toBeUndefined();
  });
});

describe('markStale', () => {
  const mark = { kind: 'range' as const, versionId: 'v4', bars: [7, 10] as [number, number], seconds: [13, 21] as [number, number] };

  it('valid on the version it was made on', () => {
    expect(markStale(mark, view())).toEqual({ kind: 'valid' });
  });

  it('carried onto a version whose edit moved no bars: same bars, seconds from its own reading', () => {
    const own = { ...READING, versionId: 'v5', number: 5, bars: { starts: READING.bars!.starts.map((s) => s + 0.5), end: 33.5 } };
    expect(markStale(mark, v5(false, null, own))).toEqual({ kind: 'carried', mark: { ...mark, versionId: 'v5', seconds: [13.5, 21.5], readAt: READING.readAt } });
    expect(markStale(mark, v5(false, null, { ...READING, mode: 'dim' }))).toEqual({ kind: 'carried', mark: { ...mark, versionId: 'v5' } });
  });

  it('stale with USE BARS when the edit reported the shift', () => {
    expect(markStale(mark, v5(true, { atBar: 3, delta: 4 }))).toEqual({ kind: 'stale', useBars: [11, 14] });
  });

  it('stale without USE BARS: no shift reported, the shift splits the mark, or a CUT removed its bars', () => {
    expect(markStale(mark, v5(true))).toEqual({ kind: 'stale', useBars: null });
    expect(markStale(mark, v5(true, { atBar: 9, delta: 4 }))).toEqual({ kind: 'stale', useBars: null });
    expect(markStale(mark, v5(true, { atBar: 6, delta: -2 }))).toEqual({ kind: 'stale', useBars: null });
  });

  it('stale when the mark is not on the playable version or its base', () => {
    expect(markStale({ ...mark, versionId: 'v2' }, v5(false))).toEqual({ kind: 'stale', useBars: null });
    expect(markStale(mark, view({ versionId: 'v9', lineage: null }))).toEqual({ kind: 'stale', useBars: null });
  });

  // C1 code review should 2: v5 is v4 at a new tempo (SET TEMPO), shown hatched until its own reading lands.
  it('across a tempo change: a bars mark carries only with v5 read; before, stale with USE BARS = the same bars', () => {
    const tempo = (shown: ShownReading | null) => view({ versionId: 'v5', number: 5, shown, lineage: { fromVersionId: 'v4', moved: false, shift: null, retimed: true } });
    expect(markStale(mark, tempo({ ...READING, mode: 'hatched', bars: null }))).toEqual({ kind: 'stale', useBars: [7, 10], tempo: true });
    expect(markStale(mark, tempo(null))).toEqual({ kind: 'stale', useBars: [7, 10], tempo: true });
    const own = { ...READING, versionId: 'v5', number: 5, bars: { starts: READING.bars!.starts.map((s) => s * 0.8), end: 26.4 } };
    expect(markStale(mark, tempo(own))).toMatchObject({ kind: 'carried', mark: { versionId: 'v5', bars: [7, 10], seconds: [10.4, 16.8] } });
  });

  it('across a tempo change a seconds-only mark (0:30-0:45) never carries, even with v5 read', () => {
    const tempo = view({ versionId: 'v5', number: 5, shown: { ...READING, versionId: 'v5', number: 5 }, lineage: { fromVersionId: 'v4', moved: false, shift: null, retimed: true } });
    expect(markStale({ kind: 'range', versionId: 'v4', seconds: [30, 45] }, tempo)).toEqual({ kind: 'stale', useBars: null, tempo: true });
  });

  it('a seconds-only mark moved bars: stale, no USE BARS', () => {
    expect(markStale({ kind: 'range', versionId: 'v4', seconds: [3, 9] }, v5(true, { atBar: 1, delta: 2 }))).toEqual({ kind: 'stale', useBars: null });
  });

  it('shifts: bars before the change stay, after it move, a CUT’s bars are gone', () => {
    expect(shiftedBars([1, 4], { atBar: 9, delta: 4 })).toEqual([1, 4]);
    expect(shiftedBars([11, 12], { atBar: 9, delta: -2 })).toEqual([9, 10]);
    expect(shiftedBars([9, 10], { atBar: 9, delta: -2 })).toBeNull();
  });
});
