import { describe, it, expect } from 'vitest';
import { draftLabel, lyricsModelsFor } from './lyricsModels.js';

const PLANNER = 'qwen3:14b';

describe('lyricsModelsFor (D-235)', () => {
  it('German defaults to two drafts: gemma3 then gemma4 (owner, D-232)', () => {
    expect(lyricsModelsFor('de', {}, PLANNER)).toEqual(['gemma3:12b', 'gemma4:26b-a4b-it-q4_K_M']);
  });

  it('every other language defaults to the planner model (no reload)', () => {
    expect(lyricsModelsFor('en', {}, PLANNER)).toEqual([PLANNER]);
    expect(lyricsModelsFor('es', {}, PLANNER)).toEqual([PLANNER]);
  });

  it('LYRICS_MODELS_<LANG> overrides, trimmed, empties dropped', () => {
    expect(lyricsModelsFor('de', { LYRICS_MODELS_DE: ' qwen3:14b ' }, PLANNER)).toEqual(['qwen3:14b']);
    expect(lyricsModelsFor('es', { LYRICS_MODELS_ES: 'a:1, ,b:2,' }, PLANNER)).toEqual(['a:1', 'b:2']);
  });

  it('uses at most two entries', () => {
    expect(lyricsModelsFor('fr', { LYRICS_MODELS_FR: 'a,b,c' }, PLANNER)).toEqual(['a', 'b']);
  });

  it('a set but empty variable falls back to the default', () => {
    expect(lyricsModelsFor('de', { LYRICS_MODELS_DE: ' , ' }, PLANNER)).toHaveLength(2);
    expect(lyricsModelsFor('en', { LYRICS_MODELS_EN: '' }, PLANNER)).toEqual([PLANNER]);
  });

  it('reads the variable of its own language only', () => {
    expect(lyricsModelsFor('en', { LYRICS_MODELS_DE: 'x' }, PLANNER)).toEqual([PLANNER]);
  });
});

describe('draftLabel', () => {
  it('names draft 0 A and draft 1 B', () => {
    expect(draftLabel(0)).toBe('A');
    expect(draftLabel(1)).toBe('B');
  });

  it('there is no third draft', () => {
    expect(() => draftLabel(2)).toThrow(RangeError);
  });
});
