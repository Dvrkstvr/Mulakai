/** The lyrics panel's rows (F-056, F-057; chat-lyrics.html LY-3, LY-4, LY-6; D-218, D-222): the section list with no
 * mark, only the marked part with one, two sections with "n more lines not marked", untimed lines, a pending rewrite
 * struck / new and PROPOSED outside the mark, and the reading / failed / no-words states. */
import { describe, it, expect } from 'vitest';
import { liveDiffs, panelRows, type PanelRows } from './chatLyricsPanel';
import { PANEL, PANEL_SECTIONS, TIMES, panelView } from './chatLyricsFixture';
import { markBars } from './chatMark';
import { READING } from './chatMarkFixture';
import type { ScoreLyricDiff } from './api/score';
import type { ChatMessageView } from './api/chat';

const V = panelView();
const mark = (from: number, to: number) => markBars(V, from, to)!;
const marked = (r: PanelRows) => { if (r.kind !== 'marked') throw new Error(`not marked: ${r.kind}`); return r; };
const texts = (r: PanelRows, i: number) => marked(r).parts[i].lines.map((l) => [l.text, l.old, l.marked]);

describe('no mark: the section list (LY-3 a)', () => {
  it('lists every section with its line count and first line', () => {
    const r = panelRows({ view: V, mark: null, times: TIMES, diffs: [] });
    expect(r).toMatchObject({ kind: 'list', dim: false, lines: 8, note: null });
    if (r.kind !== 'list') return;
    expect(r.rows.map((x) => [x.section.label, x.count, x.first, x.proposed])).toEqual([
      ['Intro', 0, null, false], ['Verse', 2, 'v1 a', false], ['Chorus', 2, 'c1 a', false], ['Verse', 2, 'v2 a', false], ['Chorus', 2, 'c2 a', false],
    ]);
  });
});

describe('a mark: only the marked part (LY-3 b, c, d)', () => {
  it('a whole section: all its lines, none tinted, with their start bars', () => {
    const r = marked(panelRows({ view: V, mark: mark(7, 10), times: TIMES, diffs: [] }));
    expect(r.parts).toHaveLength(1);
    expect(r.parts[0]).toMatchObject({ whole: true, markedBars: null, more: 0, untimed: false, proposed: false });
    expect(r.parts[0].lines.map((l) => [l.text, l.bar, l.marked])).toEqual([['c1 a', 7, false], ['c1 b', 9, false]]);
    expect(r).toMatchObject({ lines: 2, markedLines: null });
  });

  it('one line: the whole section stays, that line tinted', () => {
    const r = marked(panelRows({ view: V, mark: mark(5, 6), times: TIMES, diffs: [] }));
    expect(r.parts[0]).toMatchObject({ whole: false, markedBars: 2 });
    expect(texts(r, 0)).toEqual([['v1 a', null, false], ['v1 b', null, true]]);
    expect(r.markedLines).toBe(1);
  });

  it('two sections: each under its header; the part-marked one lists its marked lines and counts the rest', () => {
    const r = marked(panelRows({ view: V, mark: mark(7, 12), times: TIMES, diffs: [] }));
    expect(r.parts.map((p) => [p.section.strip, p.whole, p.markedBars, p.more])).toEqual([[3, true, null, 0], [4, false, 2, 1]]);
    expect(texts(r, 1)).toEqual([['v2 a', null, true]]);
    expect(r).toMatchObject({ lines: 3, markedLines: null });
  });

  it('a part-marked section with untimed lines lists all of them (D-218)', () => {
    const r = marked(panelRows({ view: V, mark: mark(7, 12), times: null, diffs: [] }));
    expect(r.parts[1]).toMatchObject({ untimed: true, more: 0 });
    expect(texts(r, 1)).toEqual([['v2 a', null, false], ['v2 b', null, false]]);
  });

  it('a heard reading marks by its lines’ own seconds', () => {
    const heard = { ...PANEL, source: 'heard' as const, text: null, sections: PANEL_SECTIONS.map((s) => ({
      ...s, lines: s.lines.map((l, i) => ({ ...l, at: { seconds: [s.seconds![0] + i * 4, s.seconds![0] + i * 4 + 4] as [number, number] } })),
    })) };
    const r = marked(panelRows({ view: panelView({}, heard), mark: mark(5, 6), times: null, diffs: [] }));
    expect(texts(r, 0)).toEqual([['v1 a', null, false], ['v1 b', null, true]]);
  });
});

describe('a pending lyric rewrite (LY-4, Q-074)', () => {
  const diff = (block: number, old: string[], next: string[]): ScoreLyricDiff => ({ block, tag: 'Chorus', occurrence: 2, old, new: next });

  it('in the marked section: the old line struck above the new', () => {
    const r = panelRows({ view: V, mark: mark(15, 16), times: TIMES, diffs: [diff(4, ['c2 a', 'c2 b'], ['c2 a', 'c2 new'])] });
    expect(texts(r, 0)).toEqual([['c2 a', null, false], ['c2 new', 'c2 b', false]]);
  });

  it('an added line has no old one; a dropped line has no new one', () => {
    const more = panelRows({ view: V, mark: mark(15, 16), times: TIMES, diffs: [diff(4, ['c2 a', 'c2 b'], ['c2 a', 'c2 b', 'c2 c'])] });
    expect(texts(more, 0)).toEqual([['c2 a', null, false], ['c2 b', null, false], ['c2 c', null, false]]);
    const fewer = panelRows({ view: V, mark: mark(15, 16), times: TIMES, diffs: [diff(4, ['c2 a', 'c2 b'], ['c2 a'])] });
    expect(texts(fewer, 0)).toEqual([['c2 a', null, false], [null, 'c2 b', false]]);
  });

  it('outside the mark: that section appended in song order, tagged PROPOSED; the mark is untouched', () => {
    const r = marked(panelRows({ view: V, mark: mark(15, 16), times: TIMES, diffs: [diff(2, ['c1 a', 'c1 b'], ['new a', 'c1 b'])] }));
    expect(r.parts.map((p) => [p.section.strip, p.proposed])).toEqual([[5, false], [3, true]]);
    expect(texts(r, 1)).toEqual([['new a', 'c1 a', false], ['c1 b', null, false]]);
    expect(r.lines).toBe(2);
  });

  it('with no mark the rewritten section’s row is tagged PROPOSED; a block no section sings is left to the card', () => {
    const r = panelRows({ view: V, mark: null, times: TIMES, diffs: [diff(2, ['c1 a'], ['x']), diff(9, ['y'], ['z'])] });
    expect(r.kind === 'list' && r.rows.map((x) => x.proposed)).toEqual([false, false, true, false, false]);
  });

  it('only the latest pending edit card’s diffs count (D-222)', () => {
    const d = diff(4, ['a'], ['b']);
    const card = (id: string, state: ChatMessageView['state'], diffs: ScoreLyricDiff[]) => ({
      id, kind: 'edit', state, body: { verdicts: diffs.map((x, index) => ({ index, op: 'REWRITE_LYRICS', ok: true, reason: null, diff: x })) },
    }) as unknown as ChatMessageView;
    expect(liveDiffs([card('e1', 'pending', [d])])).toEqual([d]);
    expect(liveDiffs([card('e1', 'superseded', [d]), card('e2', 'pending', [])])).toEqual([]);
    expect(liveDiffs([card('e1', 'done', [d])])).toEqual([]);
    expect(liveDiffs([])).toEqual([]);
  });
});

describe('states (LY-6)', () => {
  it('a reading in progress dims the old panel and names the version', () => {
    const r = panelRows({ view: panelView({ number: 5, state: { kind: 'running', jobId: 'j', step: 'WORDS', progress: null } }), mark: null, times: TIMES, diffs: [] });
    expect(r).toMatchObject({ kind: 'list', dim: true, version: 5 });
  });

  it('failed: the reason, for RETRY', () => {
    const r = panelRows({ view: panelView({ number: 5, state: { kind: 'failed', reason: 'lyrics-server did not answer', at: 'x' } }), mark: null, times: TIMES, diffs: [] });
    expect(r).toEqual({ kind: 'failed', version: 5, reason: 'lyrics-server did not answer' });
  });

  it('no words: the server’s note; an older server without lyrics reads as none', () => {
    const none = { ...PANEL, source: 'none' as const, note: 'LYRICS_API_URL is not set', text: null, sections: [] };
    expect(panelRows({ view: panelView({}, none), mark: null, times: null, diffs: [] })).toEqual({ kind: 'none', note: 'LYRICS_API_URL is not set' });
    expect(panelRows({ view: panelView({}, null), mark: null, times: null, diffs: [] })).toEqual({ kind: 'none', note: null });
  });

  it('nothing read yet, or no view: waiting', () => {
    expect(panelRows({ view: panelView({ shown: null, state: { kind: 'queued', jobId: 'j', ahead: 0 } }), mark: null, times: null, diffs: [] }))
      .toEqual({ kind: 'waiting', version: 4 });
    expect(panelRows({ view: null, mark: null, times: null, diffs: [] })).toEqual({ kind: 'waiting', version: null });
  });

  it('a mismatch note rides with the rows', () => {
    const r = panelRows({ view: panelView({}, { ...PANEL, note: 'the stored words do not match the score' }), mark: null, times: TIMES, diffs: [] });
    expect(r).toMatchObject({ kind: 'list', note: 'the stored words do not match the score' });
  });

  it('a hatched reading still lists; lines carry no bar', () => {
    const r = panelRows({ view: panelView({ shown: { ...READING, mode: 'hatched', lyrics: PANEL } }), mark: null, times: TIMES, diffs: [] });
    expect(r.kind).toBe('list');
  });
});
