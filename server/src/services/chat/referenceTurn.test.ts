/** The prompt lines a reference adds (architecture "Chat (C3)" flow 2 and 5): ATTACHED before a reading, REFERENCE after. */
import { describe, it, expect } from 'vitest';
import { readingFixture } from '../../../test-fakes/chatScripts.js';
import { REFERENCE_MAX, analyzeBody, attachedLine, clock, referenceBlock } from './referenceTurn.js';
import type { Reading, ScorePart } from './reading.js';

const score = (r: Reading) => r.score as ScorePart;

describe('attachedLine', () => {
  it('names the file, its length and that it is not read yet', () => {
    expect(attachedLine({ name: 'demo.mp3', seconds: 192 })).toBe('ATTACHED: "demo.mp3" (3:12, not read yet)');
    expect(attachedLine({ name: 'x.wav', seconds: null })).toBe('ATTACHED: "x.wav" (length unknown, not read yet)');
    expect(clock(59.6)).toBe('1:00');
  });
});

describe('referenceBlock', () => {
  it('tempo, key, meter with their source, caption, words, sections with bars and cover possible', () => {
    const text = referenceBlock('demo.mp3', readingFixture()).join('\n');
    expect(text).toContain('REFERENCE: "demo.mp3", read 0:00-3:20 of 3:20');
    expect(text).toContain('tempo 96 bpm (score) · key Am (score) · meter 4/4 (score)');
    expect(text).toContain('CAPTION: dark synthpop, analog bass, male voice');
    expect(text).toContain('WORDS: language de, 2 lines; first: Hey du, was ist los');
    expect(text).toContain('S2 verse: bars 5-16');
    expect(text).toContain('COVER: possible');
  });

  it('a part not read says why; an instrumental says there are no words; a cut file says what was read', () => {
    const r = readingFixture({ caption: { notRead: 'ACE-Step is not running' }, words: { language: null, lines: [], instrumental: true }, seconds: 470, readTo: 360, cut: true });
    const text = referenceBlock('long.mp3', r).join('\n');
    expect(text).toContain('read 0:00-6:00 of 7:50 (only the first 6:00 is read)');
    expect(text).toContain('CAPTION: not read: ACE-Step is not running');
    expect(text).toContain('WORDS: none, an instrumental');
    expect(text).toContain('tempo 96 bpm (score)');
  });

  it('a missing value says not found; a score that cannot be covered says why', () => {
    const r = readingFixture({ score: { notRead: 'yue-server is not running' }, caption: { caption: 'x', bpm: null, key: null, meter: '4/4' } });
    const text = referenceBlock('demo.mp3', r).join('\n');
    expect(text).toContain('tempo not found · key not found · meter 4/4 (caption)');
    expect(text).toContain('SECTIONS: not read: yue-server is not running');
    expect(text).toContain('COVER: not possible (the score was not read: yue-server is not running)');
  });

  it('lyric blocks give each section its line count and first sung line', () => {
    const r = readingFixture();
    const lyric_blocks = [{ index: 1, tag: '[Verse]', occurrence: 1, lines: 4, first_line: 'Hey du' }, { index: 2, tag: '[Chorus]', occurrence: 1, lines: 2, first_line: 'die Nacht' }];
    const withWords = { ...r, score: { ...score(r), facts: { ...score(r).facts!, lyric_blocks } } };
    const text = referenceBlock('demo.mp3', withWords).join('\n');
    expect(text).toContain('S2 verse: bars 5-16, 4 lines, first: Hey du');
    expect(text).toContain('S3 chorus: bars 17-24, 2 lines, first: die Nacht');
    expect(text).toContain('S4 verse 2: bars 25-32\n');
  });

  it(`trap: a 200-bar transcription stays within ${REFERENCE_MAX} characters, cut per section`, () => {
    const r = readingFixture();
    const big = (n: number) => {
      const sections = Array.from({ length: n }, (_, i) => ({ index: i + 1, label: i % 2 ? 'chorus' : 'verse', from_bar: i * 2 + 1, to_bar: i * 2 + 2 }));
      const lyric_blocks = sections.map((s, i) => ({ index: i + 1, tag: `[${s.label}]`, occurrence: Math.floor(i / 2) + 1, lines: 6, first_line: 'a very long first sung line that goes on and on' }));
      return { ...r, score: { ...score(r), facts: { ...score(r).facts!, sections, lyric_blocks, header: { ...score(r).facts!.header, bars: 200 } } } };
    };
    const fifty = referenceBlock('big.mp3', big(50)).join('\n');
    expect(fifty.length).toBeLessThanOrEqual(REFERENCE_MAX);
    expect(fifty).not.toContain('first: a very'); // the words go first, every section stays
    expect(fifty.split('\n').filter((l) => /^S\d+ /.test(l))).toHaveLength(50);
    const hundred = referenceBlock('big.mp3', big(100));
    expect(hundred.join('\n').length).toBeLessThanOrEqual(REFERENCE_MAX);
    expect(hundred.join('\n')).toMatch(/\(… \d+ more sections\)/);
    expect(hundred.at(-1)).toBe('COVER: possible');
  });
});

describe('analyzeBody (the READ card)', () => {
  it('what is read, the cut and the GPU estimate', () => {
    const plan = { words: 'service', score: 'service', caption: 'skip' } as const;
    expect(analyzeBody({ referenceId: 'r1' }, { name: 'demo.mp3', seconds: 400 }, plan)).toEqual({
      target: { referenceId: 'r1' }, name: 'demo.mp3', seconds: 400, readTo: 360, cut: true,
      estimate: { words: 22, score: 51, caption: 0, total: 73 },
    });
  });
});
