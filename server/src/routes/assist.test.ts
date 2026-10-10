import { describe, expect, it } from 'vitest';
import { parseAssist } from './assist.js';

describe('parseAssist', () => {
  it('takes the request, trimming what it does not know', () => {
    const r = parseAssist({ kind: 'lyrics', songId: 's1', caption: 'EDM', bpm: 128, layers: ['Base', 3], current: 'la', language: 'de', extra: 1 });
    expect(r).toMatchObject({ kind: 'lyrics', songId: 's1', caption: 'EDM', bpm: 128, key: null, layers: ['Base'], current: 'la', language: 'de', ask: '' });
  });

  it('refuses an unknown kind, a missing song or an oversized text', () => {
    expect(parseAssist({ kind: 'mix', songId: 's1' })).toMatch(/kind must be/);
    expect(parseAssist({ kind: 'layer' })).toBe('songId is required');
    expect(parseAssist({ kind: 'layer', songId: 's1', current: 'x'.repeat(7000) })).toMatch(/over 6000/);
  });

  it('a language that is not a code is dropped', () => {
    expect((parseAssist({ kind: 'lyrics', songId: 's1', language: 'German' }) as { language: string | null }).language).toBeNull();
  });
});
