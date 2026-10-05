import { describe, it, expect, vi } from 'vitest';
import { pickRange, shownRange } from './editorSelection';

describe('pickRange', () => {
  it('sets the range and switches the dock to REPAINT', () => {
    const setSelection = vi.fn();
    const setVerb = vi.fn();
    pickRange({ start: 2, end: 8 }, setSelection, setVerb);
    expect(setSelection).toHaveBeenCalledWith({ start: 2, end: 8 });
    expect(setVerb).toHaveBeenCalledWith('repaint');
  });

  it('clears the range without changing the verb', () => {
    const setSelection = vi.fn();
    const setVerb = vi.fn();
    pickRange(null, setSelection, setVerb);
    expect(setSelection).toHaveBeenCalledWith(null);
    expect(setVerb).not.toHaveBeenCalled();
  });

  it('under SCORE keeps the range for REPAINT but stays on SCORE (M2-2)', () => {
    const setSelection = vi.fn();
    const setVerb = vi.fn();
    pickRange({ start: 2, end: 8 }, setSelection, setVerb, 'score');
    expect(setSelection).toHaveBeenCalledWith({ start: 2, end: 8 });
    expect(setVerb).not.toHaveBeenCalled();
  });
});

describe('shownRange', () => {
  it('paints the kept range only under REPAINT', () => {
    const range = { start: 2, end: 8 };
    expect(shownRange('repaint', range)).toBe(range);
    expect(shownRange('addLayer', range)).toBeNull();
    expect(shownRange('split', range)).toBeNull();
    expect(shownRange('export', range)).toBeNull();
  });
});
