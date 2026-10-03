import { describe, it, expect } from 'vitest';
import { lineRegion, sameRegion, widenToMinimum } from './lineSelection';
import { REPAINT_MIN_SECONDS } from './repaintLimits';

const span = (start: number, end: number) => ({ start, end });

// [Verse] tag, three sung lines, a line never heard, a fourth sung line.
const SPANS = [null, span(20.98, 23.36), span(25.84, 29.32), span(31.4, 34.76), null, span(46, 50.54)];

describe('lineRegion', () => {
  it("selects one line's sung span", () => {
    expect(lineRegion(SPANS, 2, 2, 140)).toEqual({ start: 25.84, end: 29.32 });
  });

  it('spans a range in either order, from its first heard word to its last', () => {
    expect(lineRegion(SPANS, 1, 3, 140)).toEqual({ start: 20.98, end: 34.76 });
    expect(lineRegion(SPANS, 3, 1, 140)).toEqual({ start: 20.98, end: 34.76 });
    expect(lineRegion(SPANS, 3, 5, 140)).toEqual({ start: 31.4, end: 50.54 }); // the unheard line in between doesn't matter
  });

  it('is null when none of the lines were heard', () => {
    expect(lineRegion(SPANS, 4, 4, 140)).toBeNull();
    expect(lineRegion(SPANS, 0, 0, 140)).toBeNull();
  });

  it(`widens a short line to ${REPAINT_MIN_SECONDS} s`, () => {
    expect(lineRegion([span(10, 11.5)], 0, 0, 140)).toEqual({ start: 9.25, end: 12.25 });
  });
});

describe('widenToMinimum', () => {
  it('grows evenly around the middle', () => {
    expect(widenToMinimum({ start: 58.82, end: 61.12 }, 140)).toEqual({ start: 58.47, end: 61.47 });
  });

  it('keeps a long-enough region as it is', () => {
    const region = { start: 10, end: 13 };
    expect(widenToMinimum(region, 140)).toBe(region);
  });

  it('shifts instead of crossing the start or the end of the song', () => {
    expect(widenToMinimum({ start: 0.2, end: 1 }, 140)).toEqual({ start: 0, end: 3 });
    expect(widenToMinimum({ start: 139, end: 139.8 }, 140)).toEqual({ start: 137, end: 140 });
  });

  it('never grows past a song shorter than the minimum, and treats an unknown duration as open-ended', () => {
    expect(widenToMinimum({ start: 0.5, end: 1 }, 2)).toEqual({ start: 0, end: 2 });
    expect(widenToMinimum({ start: 100, end: 101 }, 0)).toEqual({ start: 99, end: 102 });
  });

  // The repaint checks (client and server) compare end − start, so 2.9999… s or 2.99 s
  // from rounding each edge on its own would make the line unrepaintable.
  it(`always comes out at least ${REPAINT_MIN_SECONDS} s long as computed by end − start`, () => {
    const lengthOf = (r: { start: number; end: number }) => r.end - r.start;
    expect(lengthOf(widenToMinimum({ start: 2.065, end: 3.565 }, 140))).toBeGreaterThanOrEqual(REPAINT_MIN_SECONDS);
    expect(lengthOf(widenToMinimum({ start: 2.06, end: 2.07 }, 140))).toBeGreaterThanOrEqual(REPAINT_MIN_SECONDS);
    for (let i = 0; i < 20000; i++) {
      const start = i / 1000;
      const region = widenToMinimum({ start, end: start + 1.5 }, 140);
      expect(lengthOf(region), `line at ${start} s`).toBeGreaterThanOrEqual(REPAINT_MIN_SECONDS);
    }
  });
});

describe('sameRegion', () => {
  it('tolerates rounding but not a moved edge', () => {
    expect(sameRegion({ start: 9.25, end: 12.25 }, { start: 9.26, end: 12.24 })).toBe(true);
    expect(sameRegion({ start: 9.25, end: 12.25 }, { start: 9.25, end: 13 })).toBe(false);
    expect(sameRegion(null, { start: 1, end: 2 })).toBe(false);
  });
});
