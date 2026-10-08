/** The lyrics panel's data (F-056, D-217, D-218): a YuE2 version's stored blocks paired with the strip's sections,
 * a transcribed version's heard lines with their seconds, a section that sings no block, a mismatch (a note, no
 * lines, never a guess) and no words (a note that says why). */
import { describe, it, expect } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
import { lyricsPanel, type PanelInput } from './lyricsPanel.js';
import { stripSections } from './analysisView.js';
import { barMap } from './barMap.js';
import type { VersionAnalysis } from './analysisTypes.js';
import type { ScoreFacts } from '../score/planTypes.js';
import type { LyricsReading } from '../lyricsClient.js';

const read = contract('read-sections');
const lyrics = read.request.body.lyrics as string;
const contractFacts = read.response.body.facts as ScoreFacts;
/** The contract song's blocks over six sections: chorus 2 sings block 5, a third chorus sings nothing. */
const sixFacts: ScoreFacts = { ...contractFacts, sections: [
  { index: 1, label: 'intro', from_bar: 1, to_bar: 4 }, { index: 2, label: 'verse', from_bar: 5, to_bar: 12 },
  { index: 3, label: 'chorus', from_bar: 13, to_bar: 16 }, { index: 4, label: 'verse', from_bar: 17, to_bar: 24 },
  { index: 5, label: 'chorus', from_bar: 25, to_bar: 28 }, { index: 6, label: 'chorus', from_bar: 29, to_bar: 32 },
] };
const bars = (n: number) => ({ starts: Array.from({ length: n }, (_, i) => i * 2), end: n * 2 });

function analysis(facts: ScoreFacts | null, source: 'own' | 'transcribed' = 'own', over: Partial<VersionAnalysis> = {}): VersionAnalysis {
  const b = bars(facts?.header.bars ?? 0);
  return {
    analysis_v: 1, versionId: 'v1', readAt: '2026-10-08T10:00:00.000Z',
    plan: { words: 'service', score: source === 'own' ? 'own' : 'service', sections: 'cached' },
    words: { language: 'en', lines: [], instrumental: false },
    score: { abc: 'X:1', source, chords: true, facts, warnings: [], measure: null },
    bars: { source: 'cached', offset: 0, starts: b.starts, end: b.end, agreement: 1 },
    ...over,
  };
}
function input(a: VersionAnalysis, over: Partial<PanelInput> = {}): PanelInput {
  const facts = 'facts' in a.score ? a.score.facts : null;
  const b = 'starts' in a.bars ? { starts: a.bars.starts, end: a.bars.end } : null;
  return { analysis: a, sections: facts ? stripSections(facts, b, null) : [], words: null, lyrics, style: 'synth pop', ...over };
}

describe('lyricsPanel · a YuE2 version (source blocks)', () => {
  it('the contract song: each strip section with the block it sings and its lines, indexed into the stored text', () => {
    const p = lyricsPanel(input(analysis(contractFacts)));
    expect(p).toMatchObject({ source: 'blocks', note: null, text: lyrics, facts: { bpm: 87, key: 'Dm', meter: '4/4', style: 'synth pop' } });
    expect(p.sections.map((s) => [s.strip, s.label, s.block, s.lines.length])).toEqual([[1, 'intro', 1, 1], [2, 'verse', 2, 8], [3, 'chorus', 3, 4], [4, 'outro', 7, 8]]);
    expect(p.sections[2]).toMatchObject({ occurrence: 1, bars: [47, 62], seconds: [92, 124] });
    expect(p.sections[2].lines[0]).toEqual({ n: 1, text: 'chorus 3 line 1', at: { textLine: 14 } });
    const rows = lyrics.split('\n');
    for (const s of p.sections) for (const l of s.lines) expect(rows[(l.at as { textLine: number }).textLine]).toBe(l.text);
  });

  it('chorus 2 sings block 5; a third chorus with no block is listed with no lines', () => {
    const p = lyricsPanel(input(analysis(sixFacts)));
    expect(p.sections.map((s) => [s.label, s.occurrence, s.block, s.lines.length])).toEqual([
      ['intro', 1, 1, 1], ['verse', 1, 2, 8], ['chorus', 1, 3, 4], ['verse', 2, 4, 8], ['chorus', 2, 5, 4], ['chorus', 3, null, 0],
    ]);
    expect(p.sections[4].lines.map((l) => l.text)).toEqual(['chorus 5 line 1', 'chorus 5 line 2', 'chorus 5 line 3', 'chorus 5 line 4']);
  });

  it("the bar map's REWRITE LYRICS of block 5 and the panel's section for block 5 are the same bars (one pairing)", () => {
    const map = barMap(sixFacts, [{ op: 'REWRITE_LYRICS', block: 5, tag: '[Chorus]', occurrence: 2, lines: [] }]);
    const sec = lyricsPanel(input(analysis(sixFacts))).sections.find((s) => s.block === 5);
    expect(map.ops[0].spans).toEqual([sec?.bars]);
  });

  it('stored lyrics that do not match the score: a note and no lines, never a guess', () => {
    const p = lyricsPanel(input(analysis(contractFacts), { lyrics: lyrics.replace('bridge 6 line 2\n', '') }));
    expect(p).toMatchObject({ source: 'none', text: null, note: expect.stringMatching(/do not match.*block 6/) });
    expect(p.sections).toHaveLength(4);
    expect(p.sections.every((s) => s.lines.length === 0)).toBe(true);
  });

  it('CRLF lyrics are stored text with \\n: textLine still indexes text.split("\\n")', () => {
    const p = lyricsPanel(input(analysis(contractFacts), { lyrics: lyrics.replace(/\n/g, '\r\n') }));
    expect(p.source).toBe('blocks');
    expect(p.text).toBe(lyrics);
  });
});

describe('lyricsPanel · a transcribed version (source heard)', () => {
  const seg = (text: string, start: number, end: number) => ({ text: ` ${text} `, start, end, words: [] });
  const words: LyricsReading = { language: 'en', segments: [seg('one', 1, 3), seg('two', 7, 9), seg('across', 19, 22), seg('three', 23, 25)] };
  const facts: ScoreFacts = { ...contractFacts, header: { ...contractFacts.header, bars: 16 }, lyric_blocks: [], sections: [
    { index: 1, label: 'verse', from_bar: 1, to_bar: 10 }, { index: 2, label: 'chorus', from_bar: 11, to_bar: 16 },
  ] };

  it("each section lists the heard lines inside its seconds; a line across an edge is in both; no text", () => {
    const p = lyricsPanel(input(analysis(facts, 'transcribed'), { words, lyrics: null }));
    expect(p).toMatchObject({ source: 'heard', note: null, text: null, facts: { bpm: 87 } });
    expect(p.sections[0].lines).toEqual([
      { n: 1, text: 'one', at: { seconds: [1, 3] } }, { n: 2, text: 'two', at: { seconds: [7, 9] } }, { n: 3, text: 'across', at: { seconds: [19, 22] } },
    ]);
    expect(p.sections[1].lines.map((l) => [l.n, l.text])).toEqual([[1, 'across'], [2, 'three']]);
    expect(p.sections.every((s) => s.block === null)).toBe(true);
  });

  it('a segment empty after trimming is skipped; the numbering stays contiguous (C2 review)', () => {
    const gappy: LyricsReading = { language: 'en', segments: [seg('one', 1, 3), seg('', 4, 5), seg('  ', 5, 6), seg('two', 7, 9)] };
    const p = lyricsPanel(input(analysis(facts, 'transcribed'), { words: gappy, lyrics: null }));
    expect(p.sections[0].lines).toEqual([{ n: 1, text: 'one', at: { seconds: [1, 3] } }, { n: 2, text: 'two', at: { seconds: [7, 9] } }]);
  });

  it('no word timings: a note naming why, no lines', () => {
    const a = analysis(facts, 'transcribed', { words: { notRead: 'lyrics-server is not set' } });
    expect(lyricsPanel(input(a, { lyrics: null }))).toMatchObject({ source: 'none', note: expect.stringMatching(/lyrics-server is not set/) });
  });

  it('heard as instrumental: a note', () => {
    const a = analysis(facts, 'transcribed', { words: { language: null, lines: [], instrumental: true } });
    expect(lyricsPanel(input(a, { lyrics: null })).note).toMatch(/instrumental/i);
  });
});

describe('lyricsPanel · no words (LY-6)', () => {
  it('a YuE2 song with no lyric blocks says there are no lyrics in this version', () => {
    const p = lyricsPanel(input(analysis({ ...contractFacts, lyric_blocks: [] }), { lyrics: '' }));
    expect(p).toMatchObject({ source: 'none', note: expect.stringMatching(/no lyrics/i), text: null });
    expect(p.sections).toHaveLength(4);
  });

  it('a YuE2 score with blocks but no stored lyrics: a note, no lines', () => {
    expect(lyricsPanel(input(analysis(contractFacts), { lyrics: null }))).toMatchObject({ source: 'none', note: expect.stringMatching(/not stored/) });
  });

  it('the score not read: no facts, no sections, the reason', () => {
    const a = analysis(null, 'own', { score: { notRead: 'yue-server is offline' } });
    expect(lyricsPanel(input(a))).toEqual({ source: 'none', note: expect.stringMatching(/yue-server is offline/), text: null, facts: null, sections: [] });
  });
});
