import { describe, it, expect } from 'vitest';
import { lyricsModelFor } from './lyricsModels.js';

const PLANNER = 'qwen3:14b';

describe('lyricsModelFor (D-235, D-237)', () => {
  it('German defaults to gemma4', () => {
    expect(lyricsModelFor('de', {}, PLANNER)).toBe('gemma4:26b-a4b-it-q4_K_M');
  });

  it('every other language defaults to the planner model (no reload)', () => {
    expect(lyricsModelFor('en', {}, PLANNER)).toBe(PLANNER);
    expect(lyricsModelFor('es', {}, PLANNER)).toBe(PLANNER);
  });

  it('LYRICS_MODEL_<LANG> overrides, trimmed', () => {
    expect(lyricsModelFor('de', { LYRICS_MODEL_DE: ' gemma3:12b ' }, PLANNER)).toBe('gemma3:12b');
    expect(lyricsModelFor('es', { LYRICS_MODEL_ES: 'a:1' }, PLANNER)).toBe('a:1');
  });

  it('a set but blank variable falls back to the default', () => {
    expect(lyricsModelFor('de', { LYRICS_MODEL_DE: '  ' }, PLANNER)).toBe('gemma4:26b-a4b-it-q4_K_M');
    expect(lyricsModelFor('en', { LYRICS_MODEL_EN: '' }, PLANNER)).toBe(PLANNER);
  });

  it('reads the variable of its own language only', () => {
    expect(lyricsModelFor('en', { LYRICS_MODEL_DE: 'x' }, PLANNER)).toBe(PLANNER);
  });
});
