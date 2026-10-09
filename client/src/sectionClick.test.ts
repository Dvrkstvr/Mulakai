/** The strip's section clicks: a click marks after the double-click window, a double-click seeks to the start and
 * never marks, a keyboard press marks at once. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StripSection } from './api/chatAnalysis';
import { DOUBLE_CLICK_MS, sectionClicks, sectionStart } from './sectionClick';

const sec = (bars: [number, number], seconds: [number, number] | null): StripSection =>
  ({ index: 0, label: 'chorus', occurrence: 1, bars, seconds, lines: 0, partialLines: 0 });
const BARS = { starts: [0, 2, 4, 6, 8], end: 10 };

describe('sectionStart', () => {
  it('a section with times starts at its first second', () => {
    expect(sectionStart(sec([3, 4], [4.2, 8]), BARS)).toBe(4.2);
  });

  it("without times, its first bar's start", () => {
    expect(sectionStart(sec([3, 4], null), BARS)).toBe(4);
  });

  it('neither times nor bars: null, no seek', () => {
    expect(sectionStart(sec([3, 4], null), null)).toBeNull();
  });
});

describe('sectionClicks', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('a single click marks once the double-click window passes', () => {
    const c = sectionClicks(); const mark = vi.fn();
    c.click(1, mark);
    vi.advanceTimersByTime(DOUBLE_CLICK_MS - 1);
    expect(mark).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(mark).toHaveBeenCalledTimes(1);
  });

  it('a double-click seeks and never marks', () => {
    const c = sectionClicks(); const mark = vi.fn(); const seek = vi.fn();
    c.click(1, mark); c.click(2, mark); c.double(seek);
    vi.advanceTimersByTime(DOUBLE_CLICK_MS * 2);
    expect(seek).toHaveBeenCalledTimes(1);
    expect(mark).not.toHaveBeenCalled();
  });

  it('a keyboard press (detail 0) marks at once', () => {
    const c = sectionClicks(); const mark = vi.fn();
    c.click(0, mark);
    expect(mark).toHaveBeenCalledTimes(1);
  });

  it('cancel drops a pending mark (the strip unmounts)', () => {
    const c = sectionClicks(); const mark = vi.fn();
    c.click(1, mark); c.cancel();
    vi.advanceTimersByTime(DOUBLE_CLICK_MS);
    expect(mark).not.toHaveBeenCalled();
  });
});
