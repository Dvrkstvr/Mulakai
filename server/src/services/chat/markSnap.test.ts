/** A seconds-only mark snapped to bars at SEND (D-194, Q-119). The two CP-C1 cases (pipeline/cp-c1/2026-10-07):
 * the bar times are rebuilt from the recorded strip sections (each section's bars spread evenly over its seconds). */
import { describe, it, expect } from 'vitest';
import { snapMark, snapToBars, type BarTimesNow } from './markSnap.js';

type Sec = [from: number, to: number, start: number, end: number];
function timesOf(sections: Sec[], end: number): BarTimesNow {
  const starts = sections.flatMap(([from, to, s, e]) => {
    const n = to - from + 1;
    return Array.from({ length: n }, (_, i) => s + ((e - s) * i) / n);
  });
  return { starts, end };
}

/** Cariñito v3 (YuE2, 161 s): chorus 2 is bars 48-55 at 1:59-2:19. */
const carinito = timesOf([
  [1, 5, 0, 12.57], [6, 22, 12.57, 55.51], [23, 30, 55.51, 75.7118], [31, 47, 75.7118, 118.6518],
  [48, 55, 118.6518, 138.8621], [56, 64, 138.8621, 161.0708],
], 161.0708);
/** Gertar v1 (YuE2, 215 s): the bridge is bars 44-52 at 1:59-2:24. */
const gertar = timesOf([
  [1, 5, 0, 11.73], [6, 14, 11.73, 37.16], [15, 22, 37.16, 59.75], [23, 26, 59.75, 71.05], [27, 35, 71.05, 96.45],
  [36, 43, 96.45, 119.03], [44, 52, 119.03, 144.44], [53, 60, 144.44, 167.03], [61, 68, 167.03, 189.62], [69, 77, 189.62, 214.8387],
], 214.8387);

describe('snapToBars', () => {
  it('CP-C1 Cariñito 0-M4: 1:59-2:18 is chorus 2, bars 48-55 (it was planned on 25-30)', () => {
    expect(snapToBars([119.05, 138.46], carinito)).toEqual([48, 55]);
  });

  it('CP-C1 Gertar 1-M4: 1:59-2:24 is the bridge, bars 44-52 (it was planned on 15-22)', () => {
    expect(snapToBars([119.43, 144.04], gertar)).toEqual([44, 52]);
  });

  const even: BarTimesNow = { starts: [0, 2, 4, 6], end: 8 };
  it.each([
    ['a bar covered by half or more is in', [0.9, 5.1] as [number, number], [1, 3]],
    ['a bar covered by less than half is out', [1.1, 4.9] as [number, number], [2, 2]],
    ['a mark inside one bar takes it', [2.2, 2.6] as [number, number], [2, 2]],
    ['a mark across a bar line, short of half of both, takes the bar of its middle', [3.5, 4.8] as [number, number], [3, 3]],
    ['the last bar runs to the end', [6.5, 8] as [number, number], [4, 4]],
  ])('%s', (_, seconds, bars) => {
    expect(snapToBars(seconds, even)).toEqual(bars);
  });

  it('nothing to snap: no bars, or a mark past the end', () => {
    expect(snapToBars([1, 2], { starts: [], end: 8 })).toBeNull();
    expect(snapToBars([9, 10], even)).toBeNull();
  });
});

describe('snapMark', () => {
  const m = { kind: 'range' as const, versionId: 'v', seconds: [119.05, 138.46] as [number, number], label: '1:59–2:18' };
  it('adds the bars and drops the time label, so the echo names the bars', () => {
    expect(snapMark(m, carinito)).toEqual({ kind: 'range', versionId: 'v', seconds: [119.05, 138.46], bars: [48, 55] });
  });

  it('keeps a mark with bars, and a mark with no bar times, as sent', () => {
    const barred = { ...m, bars: [47, 55] as [number, number] };
    expect(snapMark(barred, carinito)).toBe(barred);
    expect(snapMark(m, null)).toBe(m);
  });
});
