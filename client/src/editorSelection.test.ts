import { describe, it, expect, vi } from 'vitest';
import { laneSelect, pickRange } from './editorSelection';

describe('pickRange', () => {
  it('sets the range and leaves the verb alone', () => {
    const setSelection = vi.fn();
    pickRange({ start: 2, end: 8 }, setSelection);
    expect(setSelection).toHaveBeenCalledWith({ start: 2, end: 8 });
    pickRange(null, setSelection);
    expect(setSelection).toHaveBeenLastCalledWith(null);
  });
});

describe('laneSelect', () => {
  it('a drag on a lane that is not focused focuses it and selects there', () => {
    const onFocus = vi.fn(); const onSelect = vi.fn();
    laneSelect(false, { start: 4, end: 9 }, onFocus, onSelect);
    expect(onFocus).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith({ start: 4, end: 9 });
  });

  it("a plain click there (the waveform's clear) keeps the selection", () => {
    const onFocus = vi.fn(); const onSelect = vi.fn();
    laneSelect(false, null, onFocus, onSelect);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('on the focused lane a drag selects and a plain click keeps the selection', () => {
    const onFocus = vi.fn(); const onSelect = vi.fn();
    laneSelect(true, { start: 1, end: 5 }, onFocus, onSelect);
    expect(onSelect).toHaveBeenCalledWith({ start: 1, end: 5 });
    laneSelect(true, null, onFocus, onSelect);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onFocus).not.toHaveBeenCalled();
  });
});
