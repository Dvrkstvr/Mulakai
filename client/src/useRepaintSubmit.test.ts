import { describe, it, expect } from 'vitest';
import { useSettings } from './settings';
import { repaintRequest } from './useRepaintSubmit';

const repaintSettings = { ...useSettings.getState().repaint, crossfadeSec: 1 };
const inputs = { selection: null, duration: 60, prompt: 'brighter', lyricsUnlocked: false, lyricsDraft: '', repaintSettings };

describe('repaintRequest', () => {
  it('repaints the whole layer with no selection: start 0, end -1, no crossfade', () => {
    expect(repaintRequest(inputs)).toMatchObject({ prompt: 'brighter', start: 0, end: -1, repaint_wav_crossfade_sec: 0 });
  });

  it('refuses the whole layer of a song over the 90 s limit, or of unknown length', () => {
    expect(repaintRequest({ ...inputs, duration: 192 })).toBeNull();
    expect(repaintRequest({ ...inputs, duration: 0 })).toBeNull();
  });

  it('sends a valid selection with its crossfade, and refuses one outside 3–90 s', () => {
    expect(repaintRequest({ ...inputs, duration: 192, selection: { start: 10, end: 20 } }))
      .toMatchObject({ start: 10, end: 20, repaint_wav_crossfade_sec: 1 });
    expect(repaintRequest({ ...inputs, selection: { start: 10, end: 11 } })).toBeNull();
  });

  it('sends the lyrics draft only while one whole section is unlocked', () => {
    const sel = { selection: { start: 10, end: 20 }, lyricsDraft: '[Verse]\nnew words' };
    expect(repaintRequest({ ...inputs, ...sel })).not.toHaveProperty('lyrics');
    expect(repaintRequest({ ...inputs, ...sel, lyricsUnlocked: true })).toMatchObject({ lyrics: '[Verse]\nnew words' });
  });
});
