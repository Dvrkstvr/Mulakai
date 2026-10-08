/** Marking from the lyrics panel (F-056 #2, LY-5, D-218): a line click is its seconds snapped to bars through C1's
 * `chatMark`; a line with no time marks its section; shift-click extends; a header marks its section; double-click
 * plays from the line or the section start. */
import { describe, it, expect } from 'vitest';
import { extendMark, lineMark, lineSeconds, lineTimes, playFrom, sectionMark } from './chatLyricsMark';
import { PANEL, PANEL_SECTIONS, TIMES, panelView } from './chatLyricsFixture';
import { READING } from './chatMarkFixture';

const [, VERSE1, CHORUS1, , CHORUS2] = PANEL_SECTIONS;
const V = panelView();

describe('line times', () => {
  it('a YuE2 line is timed by its text line; a heard line carries its seconds; no time is null', () => {
    expect(lineSeconds(VERSE1.lines[1], TIMES)).toEqual([9, 13]);
    expect(lineSeconds(VERSE1.lines[1], null)).toBeNull();
    expect(lineSeconds({ n: 1, text: 'x', at: { seconds: [3, 4] } }, null)).toEqual([3, 4]);
    expect(lineSeconds({ n: 1, text: 'x', at: null }, TIMES)).toBeNull();
    expect(lineSeconds({ n: 1, text: 'x', at: { textLine: 3 } }, TIMES)).toBeNull(); // a tag line
  });

  it('aligns the panel text over word timings only for stored blocks with timings', () => {
    const timings = { language: 'en', segments: [{ text: 'morning light', start: 5, end: 9, words: [{ text: 'morning', start: 5, end: 7 }, { text: 'light', start: 7, end: 9 }] }] };
    const times = lineTimes({ ...PANEL, text: '[Verse]\nmorning light\nnever heard' }, timings)!;
    expect(times).toEqual([null, { start: 5, end: 9 }, null]);
    expect(lineTimes(PANEL, null)).toBeNull();
    expect(lineTimes({ ...PANEL, source: 'heard', text: null }, timings)).toBeNull();
    expect(lineTimes(PANEL, { language: 'en', segments: [] })).toBeNull();
  });
});

describe('click, header, shift-click', () => {
  it('a line click marks the bars it is sung over', () => {
    expect(lineMark(V, VERSE1, VERSE1.lines[1], TIMES)).toMatchObject({ bars: [5, 6], seconds: [9, 13] });
  });

  it('a line with no time marks its section (D-218)', () => {
    expect(lineMark(V, CHORUS1, CHORUS1.lines[0], null)).toMatchObject({ bars: [7, 10], seconds: [13, 21] });
  });

  it('a line shorter than a click still marks the bar it starts in', () => {
    const short = { n: 1, text: 'x', at: { seconds: [9.0, 9.1] as [number, number] } };
    expect(lineMark(V, VERSE1, short, null)).toMatchObject({ bars: [5, 5] });
  });

  it('a header marks its section; on a hatched strip by its seconds', () => {
    expect(sectionMark(V, CHORUS2)).toMatchObject({ bars: [15, 16], seconds: [29, 33] });
    const hatched = panelView({ shown: { ...READING, mode: 'hatched', lyrics: PANEL } });
    const m = sectionMark(hatched, CHORUS2)!;
    expect(m.bars).toBeUndefined();
    expect(m.seconds).toEqual([29, 33]);
  });

  it('shift-click extends the mark to the line clicked, either way', () => {
    const chorus = sectionMark(V, CHORUS1)!;
    expect(extendMark(V, chorus, lineMark(V, VERSE1, VERSE1.lines[1], TIMES))).toMatchObject({ bars: [5, 10] });
    expect(extendMark(V, chorus, lineMark(V, CHORUS2, CHORUS2.lines[0], TIMES))).toMatchObject({ bars: [7, 15] });
  });

  it('shift-click with no mark, or a mark on another version, is a plain click', () => {
    const line = lineMark(V, VERSE1, VERSE1.lines[0], TIMES)!;
    expect(extendMark(V, null, line)).toBe(line);
    expect(extendMark(V, { ...line, versionId: 'v3' }, sectionMark(V, CHORUS2))).toMatchObject({ bars: [15, 16] });
  });

  it('shift-click on a seconds-only mark extends by seconds', () => {
    const hatched = panelView({ shown: { ...READING, mode: 'hatched', lyrics: PANEL } });
    const m = extendMark(hatched, sectionMark(hatched, VERSE1), sectionMark(hatched, CHORUS1))!;
    expect(m.seconds).toEqual([5, 21]);
    expect(m.bars).toBeUndefined();
  });
});

describe('double-click plays', () => {
  it('from the line, else the section start, else nothing', () => {
    expect(playFrom(VERSE1, VERSE1.lines[1], TIMES)).toBe(9);
    expect(playFrom(VERSE1, VERSE1.lines[1], null)).toBe(5);
    expect(playFrom(VERSE1, null, TIMES)).toBe(5);
    expect(playFrom({ ...VERSE1, seconds: null }, null, null)).toBeNull();
  });
});
