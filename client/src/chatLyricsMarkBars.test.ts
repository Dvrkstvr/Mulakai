/** R-041 (C2 live B1, B5): a line mark covers the bars the line is sung in, and the number beside the line is the
 * chip's first bar. Built on the live run's Ellies City 2 reading (pipeline/c2-live.md, ACE-Step, heard lines):
 * 3.2 s bars, bar 15 = 44.85-48.05 s, so bar n starts at 0.05 + (n - 1) * 3.2. The four lines the run named are its
 * real seconds; the full 21-line reading was not kept (the run's temp data was deleted), so a sweep over the same
 * grid stands in for the other lines. */
import { describe, it, expect } from 'vitest';
import type { AnalysisView, ShownBars } from './api/chatAnalysis';
import type { PanelLine, PanelSection } from './api/chatConverge';
import { lineBars } from './chatMark';
import { lineMark } from './chatLyricsMark';
import { panelRows } from './chatLyricsPanel';
import { READING, view } from './chatMarkFixture';

const BAR = 3.2;
const BARS: ShownBars = { starts: Array.from({ length: 60 }, (_, i) => +(0.05 + i * BAR).toFixed(2)), end: +(0.05 + 60 * BAR).toFixed(2) };
const heard = (seconds: [number, number]): PanelLine => ({ n: 1, text: 'x', at: { seconds } });
const SECTION: PanelSection = { strip: 1, label: 'Chorus', occurrence: 1, bars: [1, 60], seconds: [BARS.starts[0], BARS.end], block: null, lines: [] };
const withLines = (lines: PanelLine[]): AnalysisView => view({
  shown: { ...READING, bars: BARS, lyrics: { source: 'heard', note: null, text: null, facts: null, sections: [{ ...SECTION, lines }] } },
});
const V = withLines([]);

/** How much of the line the chip's seconds hold. */
const covered = (line: [number, number], chip: [number, number]) =>
  Math.max(0, Math.min(line[1], chip[1]) - Math.max(line[0], chip[0])) / (line[1] - line[0]);

/** The live run's lines and the bar each is sung in (B1: "Anonymous and free" got bar 15; the other three < 50 %). */
const LIVE: Array<[string, [number, number], [number, number]]> = [
  ['Anonymous and free', [48.0, 49.32], [16, 16]],
  ['92.10-94.08', [92.1, 94.08], [30, 30]],
  ['98.48-100.78', [98.48, 100.78], [32, 32]],
  ['101.38-103.92', [101.38, 103.92], [33, 33]],
];

describe('a line mark covers the bars it is sung in (R-041)', () => {
  it.each(LIVE)('%s: the bars it mostly sits in', (_name, sec, bars) => {
    const m = lineMark(V, SECTION, heard(sec), null)!;
    expect(m.bars).toEqual(bars);
    expect(covered(sec, m.seconds)).toBeGreaterThanOrEqual(0.5);
  });

  it('any line on the grid, 0.5 to 9 s long: the chip holds at least half of it', () => {
    const bad: string[] = [];
    for (let len = 0.5; len <= 9; len += 0.37) {
      for (let a = 1; a + len < BARS.end - 1; a += 0.29) {
        const sec: [number, number] = [a, a + len];
        const m = lineMark(V, SECTION, heard(sec), null)!;
        if (covered(sec, m.seconds) < 0.5) bad.push(`${sec.map((x) => x.toFixed(2)).join('-')} -> ${m.bars}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("the number beside a line is its chip's first bar (B5: 27 vs BAR 28, 11 vs BAR 12)", () => {
    const secs: Array<[number, number]> = [...LIVE.map(([, s]) => s), [86.0, 88.9], [35.1, 38.0]];
    const lines = secs.map((s, i) => ({ ...heard(s), n: i + 1 }));
    const v = withLines(lines);
    const section = v.shown!.lyrics!.sections[0];
    const mark = { kind: 'range' as const, versionId: 'v4', bars: [1, 60] as [number, number], seconds: [BARS.starts[0], BARS.end] as [number, number] };
    const rows = panelRows({ view: v, mark, times: null, diffs: [] });
    if (rows.kind !== 'marked') throw new Error(rows.kind);
    expect(rows.parts[0].lines.map((l) => l.bar)).toEqual([16, 30, 32, 33, 28, 12]);
    expect(rows.parts[0].lines.map((l) => l.bar)).toEqual(lines.map((l) => lineMark(v, section, l, null)!.bars![0]));
  });
});

describe('lineBars (the D-195 rule the server snaps a seconds mark with)', () => {
  it('the bars at least half covered, else the bar holding the middle', () => {
    expect(lineBars(BARS, [48.0, 49.32])).toEqual([16, 16]);
    expect(lineBars(BARS, [44.0, 49.0])).toEqual([15, 15]); // all of bar 15; bars 14 and 16 under half
    expect(lineBars(BARS, [44.0, 51.4])).toEqual([15, 16]);
    expect(lineBars(BARS, [0, 0.03])).toEqual([1, 1]); // before the first bar: clamped to it
  });
});
