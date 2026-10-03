import { describe, it, expect } from 'vitest';
import { clampCrossfade, maxCrossfadeSec, repaintRangeValid, repaintSeconds, REPAINT_MAX_SECONDS, REPAINT_MIN_SECONDS } from './repaintLimits';

describe('maxCrossfadeSec', () => {
  it('is half the region on a short region, half the 5 s ceiling on a long one', () => {
    expect(maxCrossfadeSec(3)).toBe(1.5);
    expect(maxCrossfadeSec(4)).toBe(2);
    expect(maxCrossfadeSec(20)).toBe(2.5);
    expect(maxCrossfadeSec(REPAINT_MAX_SECONDS)).toBe(2.5);
  });

  it("rounds down to the input's 0.1 s step, never past half the region", () => {
    // A dragged region is a raw float: 4.0405 s would otherwise cap at 2.02027…
    expect(maxCrossfadeSec(4.0405)).toBe(2);
    expect(maxCrossfadeSec(3.38)).toBe(1.6);
    expect(clampCrossfade(2.5, 4.0405)).toBe(2);
  });

  it('is 0 for a region outside the repaint range', () => {
    expect(maxCrossfadeSec(0)).toBe(0);
    expect(maxCrossfadeSec(REPAINT_MIN_SECONDS - 0.1)).toBe(0);
    expect(maxCrossfadeSec(REPAINT_MAX_SECONDS + 1)).toBe(0);
  });
});

describe('clampCrossfade', () => {
  it('caps a value saved for a longer region at what this region takes', () => {
    // 2.5 s was valid on a 20 s region; a 3 s region takes at most 1.5 s.
    expect(clampCrossfade(2.5, 3)).toBe(1.5);
  });

  it('leaves a value that fits alone', () => {
    expect(clampCrossfade(1.2, 3)).toBe(1.2);
    expect(clampCrossfade(0, 20)).toBe(0);
  });

  it('turns a negative or non-numeric value into a hard cut', () => {
    expect(clampCrossfade(-1, 20)).toBe(0);
    expect(clampCrossfade(Number.NaN, 20)).toBe(0);
    expect(clampCrossfade(Number.POSITIVE_INFINITY, 20)).toBe(0);
  });

  it('is 0 on a region that cannot be repainted', () => {
    expect(clampCrossfade(2, 1)).toBe(0);
  });
});

describe('repaintRangeValid', () => {
  it('holds a selection to 3–90 s', () => {
    expect(repaintRangeValid({ start: 10, end: 40 }, 192)).toBe(true);
    expect(repaintRangeValid({ start: 10, end: 11 }, 192)).toBe(false);
    expect(repaintRangeValid({ start: 0, end: 100 }, 192)).toBe(false);
  });

  it('holds the whole layer (no selection) to the same limit, by the song length', () => {
    expect(repaintSeconds(null, 60)).toBe(60);
    expect(repaintRangeValid(null, 60)).toBe(true);
    expect(repaintRangeValid(null, REPAINT_MAX_SECONDS)).toBe(true);
    expect(repaintRangeValid(null, 192)).toBe(false);
  });

  it("refuses the whole layer while the song's length isn't known", () => {
    expect(repaintRangeValid(null, 0)).toBe(false);
  });
});
