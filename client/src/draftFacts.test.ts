import { describe, expect, it } from 'vitest';
import { draftFacts } from './draftFacts';

describe('draftFacts (the draft card\'s second line)', () => {
  const blank = { bpm: 0, keyScale: '', timeSignature: '', duration: 0, vocalLanguage: '', lyrics: '', engine: 'acestep' };

  it('names everything the draft sets', () => {
    expect(draftFacts({ bpm: 143, keyScale: 'A minor', timeSignature: '4', duration: 220, vocalLanguage: 'pl',
      lyrics: '[verse]\nline one\nline two\n\n[chorus]\nline three', engine: 'acestep' }))
      .toEqual(['143 BPM', 'A MINOR', '4/4', '3:40', 'POLISH VOCALS', 'LYRICS · 3 LINES', 'ACE-STEP']);
  });

  it('leaves AUTO fields out; just the engine for a bare draft', () => {
    expect(draftFacts(blank)).toEqual(['ACE-STEP']);
    expect(draftFacts({ ...blank, engine: 'yue2' })).toEqual(['YUE2']);
  });

  it('INSTRUMENTAL instead of a line count', () => {
    expect(draftFacts({ ...blank, lyrics: '[Instrumental]' })).toContain('INSTRUMENTAL');
  });
});
