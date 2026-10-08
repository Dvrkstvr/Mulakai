/** The bar map (F-060, D-215): built from the facts the planner saw and each op's bars on the song as read. */
import { describe, it, expect } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
import { barMap } from './barMap.js';
import type { Op, ScoreFacts } from '../score/planTypes.js';

const read = contract('read-sections').response.body.facts as ScoreFacts; // 65 bars: intro 1-10, verse 11-46, chorus 47-62, outro 63-65
const chord = (bar: number) => ({ bar, beat: 1, root: 'C', quality: 'maj' });
const phrase = (n: number) => Array.from({ length: n }, () => [{ pitch: 'C', beats: 4 }]);

/** Two choruses, the second sung by lyric block 4 ([Chorus] #2). */
const twoChoruses: ScoreFacts = {
  ...read,
  header: { ...read.header, bars: 40 },
  sections: [
    { index: 1, label: 'verse', from_bar: 1, to_bar: 8 }, { index: 2, label: 'chorus', from_bar: 9, to_bar: 16 },
    { index: 3, label: 'verse', from_bar: 17, to_bar: 24 }, { index: 4, label: 'chorus', from_bar: 25, to_bar: 32 },
    { index: 5, label: 'outro', from_bar: 33, to_bar: 40 },
  ],
  lyric_blocks: [
    { index: 1, tag: '[Verse 1]', occurrence: 1, lines: 4, first_line: 'a' }, { index: 2, tag: '[Chorus]', occurrence: 1, lines: 4, first_line: 'b' },
    { index: 3, tag: '[Verse 2]', occurrence: 2, lines: 4, first_line: 'c' }, { index: 4, tag: '[Chorus]', occurrence: 2, lines: 4, first_line: 'd' },
  ],
};

describe('barMap', () => {
  it('carries the bar count and the sections as read, each with its label occurrence', () => {
    const map = barMap(twoChoruses, []);
    expect(map.bars).toBe(40);
    expect(map.sections).toEqual([
      { label: 'verse', occurrence: 1, from: 1, to: 8 }, { label: 'chorus', occurrence: 1, from: 9, to: 16 },
      { label: 'verse', occurrence: 2, from: 17, to: 24 }, { label: 'chorus', occurrence: 2, from: 25, to: 32 },
      { label: 'outro', occurrence: 1, from: 33, to: 40 },
    ]);
    expect(map.ops).toEqual([]);
  });

  it.each<[string, Op, { spans: Array<[number, number]>; whole: boolean }]>([
    ['REHARMONIZE its bars', { op: 'REHARMONIZE', from_bar: 47, to_bar: 50, chords: [chord(47)] } as Op, { spans: [[47, 50]], whole: false }],
    ['WRITE_PHRASE start + length', { op: 'WRITE_PHRASE', start_bar: 20, instrument: 'Ins', bars: phrase(4) } as Op, { spans: [[20, 23]], whole: false }],
    ['REPEAT its section', { op: 'REPEAT', section: 3, label: 'chorus' }, { spans: [[47, 62]], whole: false }],
    ['CUT its section', { op: 'CUT', section: 4, label: 'outro' }, { spans: [[63, 65]], whole: false }],
    ['REWRITE LYRICS the section its block pairs with', { op: 'REWRITE_LYRICS', block: 7, tag: '[Outro]', occurrence: 1, lines: [] }, { spans: [[63, 65]], whole: false }],
    ['SET TEMPO the whole song', { op: 'SET_TEMPO', bpm: 88 }, { spans: [], whole: true }],
    ['TRANSPOSE the whole song', { op: 'TRANSPOSE', semitones: -2 }, { spans: [], whole: true }],
    ['EDIT STYLE the whole song', { op: 'EDIT_STYLE', style: 'jazz' }, { spans: [], whole: true }],
  ])('%s', (_name, op, want) => {
    expect(barMap(read, [op]).ops).toEqual([want]);
  });

  it('a REWRITE LYRICS of the 2nd chorus marks the 2nd chorus section', () => {
    const op: Op = { op: 'REWRITE_LYRICS', block: 4, tag: '[Chorus]', occurrence: 2, lines: ['x', 'y', 'z', 'w'] };
    expect(barMap(twoChoruses, [op]).ops).toEqual([{ spans: [[25, 32]], whole: false }]);
  });

  it('an op whose section or block is not in the read marks no bars (never a guess)', () => {
    const ops: Op[] = [
      { op: 'REPEAT', section: 9, label: 'bridge' },
      { op: 'REWRITE_LYRICS', block: 5, tag: '[Chorus]', occurrence: 2, lines: [] }, // read-sections: the 2nd chorus block has no section
    ];
    expect(barMap(read, ops).ops).toEqual([{ spans: [], whole: false }, { spans: [], whole: false }]);
  });

  it('spans are clamped to the song; one wholly past the end is dropped', () => {
    const ops = [
      { op: 'WRITE_PHRASE', start_bar: 63, instrument: 'Ins', bars: phrase(8) },
      { op: 'REHARMONIZE', from_bar: 70, to_bar: 72, chords: [chord(70)] },
    ] as Op[];
    expect(barMap(read, ops).ops).toEqual([{ spans: [[63, 65]], whole: false }, { spans: [], whole: false }]);
  });

  it('keeps one entry per op in the card\'s order (a compound plan)', () => {
    const ops = [{ op: 'SET_TEMPO', bpm: 80 }, { op: 'REHARMONIZE', from_bar: 11, to_bar: 14, chords: [chord(11)] }] as Op[];
    expect(barMap(read, ops).ops.map((o) => o.whole)).toEqual([true, false]);
  });

  it('a 200-bar song: every section and the bar count come through', () => {
    const sections = Array.from({ length: 25 }, (_, i) => ({ index: i + 1, label: i % 2 ? 'chorus' : 'verse', from_bar: i * 8 + 1, to_bar: i * 8 + 8 }));
    const facts: ScoreFacts = { ...read, header: { ...read.header, bars: 200 }, sections, lyric_blocks: [] };
    const map = barMap(facts, [{ op: 'REHARMONIZE', from_bar: 193, to_bar: 200, chords: [chord(193)] } as Op]);
    expect(map.bars).toBe(200);
    expect(map.sections).toHaveLength(25);
    expect(map.sections[24]).toEqual({ label: 'verse', occurrence: 13, from: 193, to: 200 });
    expect(map.ops).toEqual([{ spans: [[193, 200]], whole: false }]);
  });

  it('the bar count is at least the last section\'s bar (a header that undercounts)', () => {
    expect(barMap({ ...read, header: { ...read.header, bars: 60 } }, []).bars).toBe(65);
  });
});
