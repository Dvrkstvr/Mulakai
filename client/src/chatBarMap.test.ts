/** The edit card's bar map layout (F-060, D-215): sections as bands with labels thinned to fit, edited bars at least
 * 2 px, ruler ticks that never collide, whole-song ops hatched, and a hovered row's bars lit; at 32, 120 and 200 bars. */
import { describe, it, expect } from 'vitest';
import { barMapLayout, labelWidth, rulerStep, type MapLayout } from './chatBarMap';
import type { BarMap, BarMapSection } from './api/chatConverge';

/** A song of `n` sections of `len` bars, cycling Verse / Chorus after an Intro. */
function song(bars: number, len: number): BarMapSection[] {
  const out: BarMapSection[] = [];
  const seen: Record<string, number> = {};
  for (let from = 1, i = 0; from <= bars; from += len, i++) {
    const label = i === 0 ? 'Intro' : i % 2 ? 'Verse' : 'Chorus';
    seen[label] = (seen[label] ?? 0) + 1;
    out.push({ label, occurrence: seen[label], from, to: Math.min(bars, from + len - 1) });
  }
  return out;
}
const map = (bars: number, len: number, ops: BarMap['ops']): BarMap => ({ bars, sections: song(bars, len), ops });

function noOverlap(l: MapLayout) {
  for (const b of l.bands) if (b.text) expect(labelWidth(b.text)).toBeLessThanOrEqual(b.w);
  for (let i = 1; i < l.ticks.length; i++) expect(l.ticks[i].x - l.ticks[i - 1].x).toBeGreaterThanOrEqual(labelWidth(l.ticks[i - 1].text));
}

describe('bands, cells and ticks', () => {
  it('32 bars: every band labelled in full (a label sung once has no number)', () => {
    const l = barMapLayout(map(32, 8, [{ spans: [[9, 12]], whole: false }]), 320);
    expect(l.barW).toBe(10);
    expect(l.bands.map((b) => [b.text, b.x, b.w])).toEqual([['INTRO', 0, 80], ['VERSE 1', 80, 80], ['CHORUS', 160, 80], ['VERSE 2', 240, 80]]);
    expect(l.cells).toEqual([{ from: 9, to: 12, x: 80, w: 40 }]);
    expect(l.ticks[0]).toEqual({ bar: 1, x: 0, text: '1' });
    noOverlap(l);
  });

  it('120 bars: labels thin to the short name or none, still no overlap', () => {
    const l = barMapLayout(map(120, 4, [{ spans: [[47, 50]], whole: false }]), 320);
    expect(l.bands.some((b) => b.text && b.text.length <= 3)).toBe(true);
    noOverlap(l);
  });

  it('200 bars (a cover): one edited bar is still 2 px, ticks step so they never collide', () => {
    const l = barMapLayout(map(200, 8, [{ spans: [[200, 200]], whole: false }, { spans: [[47, 50]], whole: false }]), 320);
    expect(l.barW).toBeCloseTo(1.6);
    expect(l.cells.map((c) => [c.from, c.to])).toEqual([[47, 50], [200, 200]]);
    const last = l.cells[1];
    expect(last.w).toBe(2);
    expect(last.x + last.w).toBeLessThanOrEqual(320);
    expect(l.ticks.length).toBeGreaterThan(3);
    expect(l.ticks.every((t) => t.bar >= 1 && t.bar <= 200)).toBe(true);
    noOverlap(l);
  });

  it('merges overlapping and touching spans, clamps them to the song', () => {
    const l = barMapLayout(map(32, 8, [{ spans: [[3, 6], [7, 8]], whole: false }, { spans: [[5, 40]], whole: false }, { spans: [[0, 1]], whole: false }]), 320);
    expect(l.cells.map((c) => [c.from, c.to])).toEqual([[1, 1], [3, 32]]);
  });
});

describe('the ruler steps as drawn (chat-converge.html 4a-4b): 8, 10 over 50 bars, 20 over 100', () => {
  const bars = (n: number, width = 730) => barMapLayout(map(n, 8, []), width).ticks.map((t) => t.bar);
  it('32 bars: every 8', () => expect(bars(32)).toEqual([1, 9, 17, 25]));
  it('65 bars: every 10', () => expect(bars(65)).toEqual([1, 11, 21, 31, 41, 51, 61]));
  it('120 bars: every 20', () => expect(bars(120)).toEqual([1, 21, 41, 61, 81, 101]));
  it('200 bars: every 20', () => expect(bars(200)).toEqual([1, 21, 41, 61, 81, 101, 121, 141, 161, 181]));
  it('a map too narrow for the drawn step doubles it rather than let labels touch', () => {
    expect(rulerStep(200)).toBe(20);
    const l = barMapLayout(map(200, 8, []), 120);
    expect(l.ticks[1].bar - l.ticks[0].bar).toBeGreaterThan(20);
    noOverlap(l);
  });
});

describe('whole-song ops and hover', () => {
  const m = map(32, 8, [{ spans: [], whole: true }, { spans: [[9, 10], [25, 26]], whole: false }]);

  it('a whole-song op hatches the map, adds no cells', () => {
    const l = barMapLayout(m, 320);
    expect(l.whole).toBe(true);
    expect(l.cells.map((c) => [c.from, c.to])).toEqual([[9, 10], [25, 26]]);
    expect(l.lit).toEqual([]);
    expect(l.litWhole).toBe(false);
  });

  it('hovering a row lights that op’s bars; a whole-song row lights the whole map', () => {
    expect(barMapLayout(m, 320, 1).lit.map((c) => [c.from, c.to, c.x])).toEqual([[9, 10, 80], [25, 26, 240]]);
    expect(barMapLayout(m, 320, 0)).toMatchObject({ lit: [], litWhole: true });
    expect(barMapLayout(m, 320, 7)).toMatchObject({ lit: [], litWhole: false }); // a row the map has no op for
  });

  it('an empty song or no width draws nothing', () => {
    expect(barMapLayout({ bars: 0, sections: [], ops: [] }, 320)).toMatchObject({ bands: [], cells: [], ticks: [] });
    expect(barMapLayout(m, 0)).toMatchObject({ bands: [], cells: [], ticks: [] });
  });
});
