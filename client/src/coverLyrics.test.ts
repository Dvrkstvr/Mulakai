import { describe, it, expect } from 'vitest';
import { fitLyricsToSections, hasWords, scoreSections, sectionOutline } from './coverLyrics';

const SCORE = ['X:1', 'K:Fm', '% intro', 'V: Vocal', 'Z|', '% verse', 'V: Vocal', 'C8|', '% chorus', 'V: Vocal', 'C8|',
  '% pre-chorus', 'V: Vocal', 'C8|', '% interlude', 'V: Vocal', 'Z|', '% outro', 'V: Vocal', 'C8|'].join('\n');

describe('cover lyrics', () => {
  it('reads the score\'s sections as lyric tags', () => {
    expect(scoreSections(SCORE)).toEqual(['Intro', 'Verse', 'Chorus', 'Pre-Chorus', 'Interlude', 'Outro']);
    expect(sectionOutline(SCORE)).toBe('[Intro]\n\n[Verse]\n\n[Chorus]\n\n[Pre-Chorus]\n\n[Interlude]\n\n[Outro]');
  });

  it('puts each block of words, in order, under the next sung section', () => {
    const source = '[Intro]\n[Electric piano melody]\n\n[Verse 1]\nMidnight city\nNeon signs\n\n[Chorus]\nIn the shadows\n\n'
      + '[Bridge]\nThe city never sleeps\n\n[Outro]\nIn the shadows\n[Humming]\n[Humming]';
    expect(fitLyricsToSections(source, SCORE)).toBe(
      '[Intro]\n\n[Verse]\nMidnight city\nNeon signs\n\n[Chorus]\nIn the shadows\n\n'
      + '[Pre-Chorus]\nThe city never sleeps\n\n[Interlude]\n\n[Outro]\nIn the shadows');
  });

  it('keeps leftover words in the last sung section, and leaves lyrics alone without sections', () => {
    const fitted = fitLyricsToSections('one\n\n[x]\ntwo\n[y]\nthree\n[z]\nfour\n[w]\nfive', SCORE);
    expect(fitted.endsWith('[Outro]\nfour\nfive')).toBe(true);
    expect(fitLyricsToSections('[Verse]\nla', 'X:1\nK:C\n')).toBe('[Verse]\nla');
    expect(fitLyricsToSections('', SCORE)).toBe(sectionOutline(SCORE));
  });

  it('treats tags-only lyrics as an instrumental, as yue-server does', () => {
    expect(hasWords(sectionOutline(SCORE))).toBe(false);
    expect(hasWords('')).toBe(false);
    expect(hasWords('[Verse]\nla')).toBe(true);
  });
});
