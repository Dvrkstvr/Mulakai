import { describe, it, expect } from 'vitest';
import { addLayerFieldsUnchanged, repaintFieldsUnchanged } from './landedFields';

describe('repaintFieldsUnchanged', () => {
  const submitted = { prompt: 'brighter lead', start: 2.5, end: 8.5 };

  it('clears a range and instruction that still hold what the repaint was submitted with', () => {
    expect(repaintFieldsUnchanged(submitted, { start: 2.5, end: 8.5 }, 'brighter lead')).toBe(true);
    expect(repaintFieldsUnchanged({ prompt: 'x', start: 0, end: -1 }, null, 'x')).toBe(true); // the whole layer
  });

  it('keeps a range or instruction set up after the commit', () => {
    expect(repaintFieldsUnchanged(submitted, { start: 10, end: 14 }, 'brighter lead')).toBe(false);
    expect(repaintFieldsUnchanged(submitted, { start: 2.5, end: 8.5 }, 'darker pad')).toBe(false);
    expect(repaintFieldsUnchanged(submitted, null, 'brighter lead')).toBe(false);
    expect(repaintFieldsUnchanged(undefined, null, '')).toBe(false);
  });
});

describe('addLayerFieldsUnchanged', () => {
  const submitted = { prompt: 'warm strings', trackName: 'strings', lyrics: '' };

  it('starts the fields over only while they hold the submitted layer', () => {
    expect(addLayerFieldsUnchanged(submitted, 'warm strings', 'strings', '')).toBe(true);
    expect(addLayerFieldsUnchanged(submitted, 'punchy drums', 'drums', '')).toBe(false);
    expect(addLayerFieldsUnchanged(submitted, 'warm strings', 'brass', '')).toBe(false);
    expect(addLayerFieldsUnchanged({ ...submitted, trackName: 'vocals', lyrics: '[verse] la' }, 'warm strings', 'vocals', '[verse] new'))
      .toBe(false);
    expect(addLayerFieldsUnchanged(undefined, '', '', '')).toBe(false);
  });
});
