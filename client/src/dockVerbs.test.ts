import { describe, it, expect } from 'vitest';
import { BASE_VERBS, dockVerbs, verbOfKey } from './dockVerbs';

describe('dockVerbs (F-021 #1, #5)', () => {
  it('shows four tabs as today when SCORE is hidden (ACE-Step song, no LLM_API_URL)', () => {
    expect(dockVerbs(false).map((v) => v.label)).toEqual(['REPAINT', 'ADD LAYER', 'SPLIT', 'EXPORT']);
  });

  it('appends SCORE last with key C for a YuE2 song', () => {
    expect(dockVerbs(true).map((v) => `${v.label}:${v.key}`)).toEqual(['REPAINT:R', 'ADD LAYER:L', 'SPLIT:S', 'EXPORT:E', 'SCORE:C']);
  });

  it('no two verbs share a key', () => {
    const keys = dockVerbs(true).map((v) => v.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('C picks SCORE only when it is on show; R/L/S/E keep working', () => {
    expect(verbOfKey(dockVerbs(true), 'c')).toBe('score');
    expect(verbOfKey(dockVerbs(false), 'c')).toBeNull();
    expect(verbOfKey(BASE_VERBS, 'R')).toBe('repaint');
    expect(verbOfKey(dockVerbs(true), 'e')).toBe('export');
  });
});
