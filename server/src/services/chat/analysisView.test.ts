/** The player's view of a song's analysis (F-053 #1-3, F-052 #1, D-179, D-180): state, current / dim / hatched,
 * bar starts, strip sections with line counts, transcribed. */
import { describe, it, expect } from 'vitest';
import { analysisView, stripSections, type ViewInput } from './analysisView.js';
import type { VersionAnalysis } from './analysisTypes.js';
import type { ScoreFacts } from '../score/planTypes.js';
import type { LyricsReading } from '../lyricsClient.js';

const facts = (over: Partial<ScoreFacts> = {}): ScoreFacts => ({
  header: { meter: '4/4', unit: '1/8', bpm: 120, key: 'C', bars: 8, seconds: 16, units_per_quarter: 2 },
  key_notes: '',
  sections: [
    { index: 1, label: 'verse', from_bar: 1, to_bar: 2 },
    { index: 2, label: 'chorus', from_bar: 3, to_bar: 4 },
    { index: 3, label: 'verse', from_bar: 5, to_bar: 6 },
    { index: 4, label: 'chorus', from_bar: 7, to_bar: 8 },
  ],
  lyric_blocks: [
    { index: 1, tag: 'verse', occurrence: 1, lines: 4, first_line: 'a' },
    { index: 2, tag: 'chorus', occurrence: 1, lines: 3, first_line: 'b' },
    { index: 3, tag: 'verse', occurrence: 2, lines: 4, first_line: 'c' },
  ],
  bar_map: [],
  ...over,
});
const starts = [0, 2, 4, 6, 8, 10, 12, 14];
const analysis = (versionId: string, over: Partial<VersionAnalysis> = {}): VersionAnalysis => ({
  analysis_v: 1, versionId, readAt: '2026-10-07T10:00:00.000Z',
  plan: { words: 'service', score: 'own', sections: 'cached' },
  words: { language: 'en', lines: ['l1', 'l2'], instrumental: false },
  score: { abc: 'X:1', source: 'own', chords: true, facts: facts(), warnings: [], measure: null },
  bars: { source: 'cached', offset: 0, starts, end: 16, agreement: 0.9 },
  ...over,
});
const base = (over: Partial<ViewInput> = {}): ViewInput => ({
  songId: 's1', playable: { id: 'v4', number: 4 }, current: null, currentWords: null,
  older: null, olderShift: { moved: false }, parent: null, job: null, ...over,
});

describe('stripSections', () => {
  it("are the score's sections; a chorus with no lyric block is on the strip with 0 lines (F-053 #1)", () => {
    const s = stripSections(facts(), { starts, end: 16 }, null);
    expect(s.map((x) => [x.label, x.occurrence, x.lines])).toEqual([['verse', 1, 4], ['chorus', 1, 3], ['verse', 2, 4], ['chorus', 2, 0]]);
    expect(s[3]).toMatchObject({ index: 4, bars: [7, 8], seconds: [12, 16], partialLines: 0 });
  });

  it("CP-C1: yue-server's own tags ([Verse], [Verse 2], [Chorus]) pair by kind: the k-th section of a kind sings the k-th block of it (D-066 d)", () => {
    const tagged = facts({ lyric_blocks: [
      { index: 1, tag: '[Verse]', occurrence: 1, lines: 4, first_line: 'a' },
      { index: 2, tag: '[Chorus]', occurrence: 1, lines: 3, first_line: 'b' },
      { index: 3, tag: '[Verse 2]', occurrence: 2, lines: 5, first_line: 'c' },
    ] });
    const s = stripSections(tagged, { starts, end: 16 }, null);
    expect(s.map((x) => [x.label, x.occurrence, x.lines])).toEqual([['verse', 1, 4], ['chorus', 1, 3], ['verse', 2, 5], ['chorus', 2, 0]]);
  });

  it('no bar times: sections keep bars, no seconds', () => {
    expect(stripSections(facts(), null, null)[0]).toMatchObject({ bars: [1, 2], seconds: null });
  });

  it('a section past the bar times has no seconds', () => {
    expect(stripSections(facts(), { starts: [0, 2], end: 4 }, null)[2].seconds).toBeNull();
  });

  it('a transcribed score counts the word segments inside each section, and those crossing its edges', () => {
    const words: LyricsReading = { language: 'en', segments: [
      { text: 'a', start: 0.5, end: 1.5, words: [] }, { text: 'b', start: 2.5, end: 4.5, words: [] },
      { text: 'c', start: 5, end: 6, words: [] }, { text: 'd', start: 13, end: 14, words: [] },
    ] };
    const s = stripSections(facts(), { starts, end: 16 }, words);
    expect(s.map((x) => [x.lines, x.partialLines])).toEqual([[2, 1], [2, 1], [0, 0], [1, 0]]);
  });
});

describe('analysisView', () => {
  it('a song with no playable version has nothing to show', () => {
    expect(analysisView(base({ playable: null }))).toEqual({ songId: 's1', versionId: null, number: null, state: { kind: 'none' }, shown: null, lineage: null });
  });

  it("a current reading: done, the playable version's bars and sections, READ v4 · 4 SECTIONS · 11 LINES", () => {
    const v = analysisView(base({ current: analysis('v4') }));
    expect(v.state).toEqual({ kind: 'done' });
    expect(v.shown).toMatchObject({ versionId: 'v4', number: 4, mode: 'current', bars: { starts, end: 16 }, lines: 11, transcribed: false });
    expect(v.shown?.sections).toHaveLength(4);
    expect(v.shown?.notRead).toEqual({ words: null, score: null, bars: null });
  });

  it('the queue position and the running step come from the live job', () => {
    expect(analysisView(base({ job: { jobId: 'j', status: 'queued', ahead: 2, progressText: null } })).state)
      .toEqual({ kind: 'queued', jobId: 'j', ahead: 2 });
    expect(analysisView(base({ job: { jobId: 'j', status: 'running', ahead: 0, progressText: 'SCORE · transcribing 41%' } })).state)
      .toEqual({ kind: 'running', jobId: 'j', step: 'SCORE', progress: 'SCORE · transcribing 41%' });
    expect(analysisView(base({ job: { jobId: 'j', status: 'running', ahead: 0, progressText: 'starting' } })).state)
      .toMatchObject({ step: null });
  });

  it("while v4 is read, v3's reading stays dimmed when the edit moved no bars (F-053 #2)", () => {
    const v = analysisView(base({
      older: { versionId: 'v3', number: 3, analysis: analysis('v3'), words: null }, olderShift: { moved: false },
      parent: { versionId: 'v3', shift: { moved: false } }, job: { jobId: 'j', status: 'running', ahead: 0, progressText: 'WORDS' },
    }));
    expect(v.shown).toMatchObject({ versionId: 'v3', number: 3, mode: 'dim', bars: { starts, end: 16 } });
    expect(v.lineage).toEqual({ fromVersionId: 'v3', moved: false, shift: null });
  });

  it('an edit that moved bars hatches the older reading: no bars, mark by time', () => {
    const shift = { moved: true as const, shift: { atBar: 5, delta: -2 } };
    const v = analysisView(base({ older: { versionId: 'v3', number: 3, analysis: analysis('v3'), words: null }, olderShift: shift, parent: { versionId: 'v3', shift } }));
    expect(v.shown).toMatchObject({ mode: 'hatched', bars: null });
    expect(v.lineage).toEqual({ fromVersionId: 'v3', moved: true, shift: { atBar: 5, delta: -2 } });
  });

  it('a failed reading is stored, says why, and hatches the strip (D-179)', () => {
    const v = analysisView(base({
      current: { analysis_v: 1, versionId: 'v4', failed: 'the planner is loaded', at: 't' },
      older: { versionId: 'v3', number: 3, analysis: analysis('v3'), words: null }, olderShift: { moved: false },
    }));
    expect(v.state).toEqual({ kind: 'failed', reason: 'the planner is loaded', at: 't' });
    expect(v.shown?.mode).toBe('hatched');
    expect(analysisView(base({ current: { analysis_v: 1, versionId: 'v4', failed: 'x', at: 't' } })).shown).toBeNull();
  });

  it('a RETRY queued after a failure shows the queue, not the failure', () => {
    const v = analysisView(base({ current: { analysis_v: 1, versionId: 'v4', failed: 'x', at: 't' }, job: { jobId: 'j', status: 'queued', ahead: 0, progressText: null } }));
    expect(v.state.kind).toBe('queued');
  });

  it('a current reading whose bars were not read is hatched, with the reason', () => {
    const v = analysisView(base({ current: analysis('v4', { bars: { notRead: 'YUE_API_URL is not set' } }) }));
    expect(v.shown).toMatchObject({ mode: 'hatched', bars: null, notRead: { bars: 'YUE_API_URL is not set' } });
    expect(v.shown?.sections[0].seconds).toBeNull();
  });

  it('an ACE-Step version shows its transcribed score; lines are the words read (F-053 edge)', () => {
    const words: LyricsReading = { language: 'en', segments: [{ text: 'a', start: 0.5, end: 1, words: [] }] };
    const score = { abc: 'X:1', source: 'transcribed' as const, chords: true, facts: facts({ lyric_blocks: [] }), warnings: [], measure: null };
    const v = analysisView(base({ current: analysis('v4', { score }), currentWords: words }));
    expect(v.shown).toMatchObject({ transcribed: true, lines: 2 });
    expect(v.shown?.sections[0]).toMatchObject({ lines: 1 });
  });

  it('a score not read: no sections, the reason, no WORDS lines lost', () => {
    const v = analysisView(base({ current: analysis('v4', { score: { notRead: 'YUE_API_URL is not set' }, bars: { notRead: 'YUE_API_URL is not set' } }) }));
    expect(v.shown).toMatchObject({ mode: 'hatched', sections: [], lines: 2, notRead: { score: 'YUE_API_URL is not set' } });
  });
});
