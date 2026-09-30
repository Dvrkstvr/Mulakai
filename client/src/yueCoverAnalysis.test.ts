import { describe, it, expect } from 'vitest';
import type { RefineResult } from './api';
import { yueAnalysisPatch, type YueAnalysisTarget } from './yueCoverAnalysis';

const R: RefineResult = {
  caption: 'A dreamy trip-hop track with a breathy female vocal over a deep sub-bass and dusty drums.',
  lyrics: '[Verse 1]\nMidnight city\n\n[Chorus]\nHold on',
  bpm: 90, key_scale: 'F minor', duration: 140, vocal_language: 'en',
};
const EMPTY: YueAnalysisTarget = { prompt: '', lyrics: '', vocalLanguage: '', carried: false, abc: null, languages: ['en', 'zh'] };
const SCORE = 'X:1\n% intro\nV: Vocal\nZ|\n% verse\nC8|\n% chorus\nD8|\n';

describe('yueAnalysisPatch', () => {
  it('fills empty fields: PROMPT as tags, LYRICS as described, VOCAL LANGUAGE — never BPM/KEY/DURATION', () => {
    const a = yueAnalysisPatch(R, EMPTY);
    expect(a.patch).toEqual({
      prompt: 'breathy female vocal, trip-hop, dreamy, deep sub-bass, dusty drums',
      lyrics: R.lyrics,
      vocalLanguage: 'en',
    });
    expect(a).toMatchObject({ prompt: 'tags', lyrics: 'filled' });
  });

  it('never overwrites a prompt or words typed on this tab', () => {
    const a = yueAnalysisPatch(R, { ...EMPTY, prompt: 'my style', lyrics: 'my words', vocalLanguage: 'zh' });
    expect(a.patch).toEqual({});
    expect(a).toMatchObject({ prompt: 'kept', lyrics: 'kept' });
  });

  it('overwrites text carried in from another tab', () => {
    const a = yueAnalysisPatch(R, { ...EMPTY, prompt: 'a whole new song', lyrics: 'other words', carried: true });
    expect(a.patch.prompt).toMatch(/^breathy female vocal/);
    expect(a.patch.lyrics).toBe(R.lyrics);
  });

  it("fits the words onto the score's sections, replacing a words-free outline", () => {
    const a = yueAnalysisPatch(R, { ...EMPTY, lyrics: '[Intro]\n\n[Verse]\n\n[Chorus]', abc: SCORE });
    expect(a.patch.lyrics).toBe('[Intro]\n\n[Verse]\nMidnight city\n\n[Chorus]\nHold on');
  });

  it('keeps the caption as written when no style word is recognised', () => {
    const a = yueAnalysisPatch({ ...R, caption: 'Hard to describe.' }, EMPTY);
    expect(a.patch.prompt).toBe('Hard to describe.');
    expect(a.prompt).toBe('prose');
  });

  it('leaves LYRICS alone when the description has no words, and skips a language the engine lacks', () => {
    const a = yueAnalysisPatch({ ...R, lyrics: '[Instrumental]', vocal_language: 'ja' }, EMPTY);
    expect(a.patch.lyrics).toBeUndefined();
    expect(a.patch.vocalLanguage).toBeUndefined();
    expect(a.lyrics).toBe('none');
  });
});
