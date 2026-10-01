import { describe, it, expect } from 'vitest';
import type { WordTimings } from './api';
import { alignLyrics, similarity, tokenize, LINE_GAP_SECONDS } from './lyricAlign';

/** One segment per argument, each word given as [text, start, end]. */
function reading(...segments: [string, number, number][][]): WordTimings {
  return {
    language: 'en',
    segments: segments.map((words) => ({
      text: words.map((w) => w[0]).join(' '),
      start: words[0][1],
      end: words[words.length - 1][2],
      words: words.map(([text, start, end]) => ({ text, start, end })),
    })),
  };
}

/** Words of `line` sung one per second from `at`. */
const sung = (line: string, at: number): [string, number, number][] =>
  line.split(' ').map((w, i) => [w, at + i, at + i + 1]);

describe('tokenize', () => {
  it('drops tags and punctuation, lowercases, removes apostrophes and splits CJK per character', () => {
    expect(tokenize("[Verse 1] Don't stop, the Neon-signs!")).toEqual(['dont', 'stop', 'the', 'neonsigns']);
    expect(tokenize('Straße ÜBER')).toEqual(['straße', 'über']);
    expect(tokenize('你好 世界')).toEqual(['你', '好', '世', '界']);
    expect(tokenize('[Chorus]')).toEqual([]);
  });
});

describe('similarity', () => {
  it('matches near spellings and rejects different words', () => {
    expect(similarity('silhouettes', 'silhouette')).toBeGreaterThanOrEqual(0.6);
    expect(similarity('wet', 'wet')).toBe(1);
    expect(similarity('night', 'city')).toBeLessThan(0.6);
    expect(similarity('a', 'anonymous')).toBe(0);
  });
});

describe('alignLyrics', () => {
  it('times each line from its first to its last heard word, leaving tags and blanks null', () => {
    const lyrics = '[Verse 1]\nMidnight city streets\nNeon signs and silhouettes\n\n[Chorus]\nIn the shadows';
    const result = alignLyrics(lyrics, reading(
      sung('Midnight city streets', 20),
      sung('Neon signs and silhouette', 25),
      sung('In the shadows', 46),
    ));
    expect(result.lines).toEqual([null, { start: 20, end: 23 }, { start: 25, end: 29 }, null, null, { start: 46, end: 49 }]);
    expect(result.matched).toBe(1);
  });

  it('keeps repeated choruses apart by order', () => {
    const lyrics = 'In the shadows\nConcrete jungle\nIn the shadows';
    const result = alignLyrics(lyrics, reading(sung('In the shadows', 46), sung('Concrete jungle', 70), sung('In the shadows', 101)));
    expect(result.lines).toEqual([{ start: 46, end: 49 }, { start: 70, end: 72 }, { start: 101, end: 104 }]);
  });

  it('leaves a line that was never sung untimed and skips ad-libs Whisper heard', () => {
    const lyrics = 'Walking through the maze\n(Mmm mmm mmm)\nLost inside this haze';
    const result = alignLyrics(lyrics, reading(
      sung('Walking through the maze', 30),
      sung('yeah yeah', 35),
      sung('Lost inside this haze', 38),
    ));
    expect(result.lines).toEqual([{ start: 30, end: 34 }, null, { start: 38, end: 42 }]);
    expect(result.matched).toBeCloseTo(8 / 11);
  });

  it('lets a misheard first word anchor its line once another word matched', () => {
    const result = alignLyrics('Crashing signs and silhouettes', reading(sung('Neon signs and silhouettes', 24)));
    expect(result.lines).toEqual([{ start: 24, end: 28 }]);
    expect(result.matched).toBe(0.75);
  });

  it('pairs a line Whisper heard twice with its first hearing, whole', () => {
    const lyrics = 'Die Welt dreht laut doch ich bleibe wie im Traum\nEin Held muss stark sein';
    const result = alignLyrics(lyrics, reading(
      sung('Die Welt weht laut doch ich bleibe wie im Traum', 153),
      sung('Ein Held muss stark sein', 163),
      sung('Ein Qued muss start doch ich bleibe wie im Traum', 187),
      sung('Ein Held muss stark sein', 197),
    ));
    expect(result.lines).toEqual([{ start: 153, end: 163 }, { start: 163, end: 168 }]);
  });

  it(`keeps the larger cluster when a line's heard words are more than ${LINE_GAP_SECONDS} s apart`, () => {
    const result = alignLyrics('Die Welt dreht laut doch ich bleibe wie im Traum', reading(
      sung('Die Welt dreht laut', 153),
      sung('doch ich bleibe wie im Traum', 187),
    ));
    expect(result.lines).toEqual([{ start: 187, end: 193 }]);
    expect(result.matched).toBe(1);
  });

  it('times nothing when nothing was heard, and reports no words as 0 matched', () => {
    expect(alignLyrics('Midnight city', { language: 'en', segments: [] })).toEqual({ lines: [null], matched: 0 });
    expect(alignLyrics('[Intro]\n[Outro]', reading(sung('hello', 1))).matched).toBe(0);
  });

  it('aligns CJK lyrics character by character', () => {
    const result = alignLyrics('你好\n世界', reading([['你好', 5, 6]], [['世界', 8, 9]]));
    expect(result.lines).toEqual([{ start: 5, end: 6 }, { start: 8, end: 9 }]);
  });
});
