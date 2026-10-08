/** The edit card's bar map, laid out (F-060, D-215): the server's `BarMap` and the card's width in, geometry out. The
 * song's sections are bands, labelled in full when the name fits, else by a short name, else not at all; the edited
 * bars (every op's spans, merged) are cells at least 2 px wide; ruler ticks step by a power of two so labels never
 * collide; a whole-song op (SET TEMPO, TRANSPOSE, EDIT STYLE) hatches the map; a hovered change-list row lights its
 * op's bars. x is in px from the map's left edge. Pure. */
import type { BarMap } from './api/chatConverge';
import { panelName } from './chatConvergeCopy';

/** The map's labels are 9 px monospace: about 6 px a character, plus the band's left padding. */
const CHAR_PX = 6;
const LABEL_PAD = 4;
export const MIN_CELL_PX = 2;
const STEPS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];

export const labelWidth = (text: string) => text.length * CHAR_PX + LABEL_PAD;

export interface MapBand { label: string; occurrence: number; from: number; to: number; x: number; w: number; text: string | null }
export interface MapCell { from: number; to: number; x: number; w: number }
export interface MapTick { bar: number; x: number; text: string }
export interface MapLayout {
  width: number; barW: number; bands: MapBand[]; cells: MapCell[]; ticks: MapTick[];
  /** Some op changes the whole song: draw the hatch. */
  whole: boolean;
  /** The hovered op's bars, and whether it is a whole-song op. */
  lit: MapCell[]; litWhole: boolean;
}

/** Spans clamped to 1..bars, sorted, overlapping and touching ones merged. */
function merge(spans: Array<[number, number]>, bars: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const clamped = spans
    .map(([a, b]): [number, number] => [Math.max(1, Math.min(a, b)), Math.min(bars, Math.max(a, b))])
    .filter(([a, b]) => a <= b)
    .sort((x, y) => x[0] - y[0]);
  for (const s of clamped) {
    const last = out.at(-1);
    if (last && s[0] <= last[1] + 1) last[1] = Math.max(last[1], s[1]);
    else out.push([s[0], s[1]]);
  }
  return out;
}

function cellsOf(spans: Array<[number, number]>, bars: number, barW: number, width: number): MapCell[] {
  return merge(spans, bars).map(([from, to]) => {
    const w = Math.max(MIN_CELL_PX, (to - from + 1) * barW);
    return { from, to, x: Math.min((from - 1) * barW, width - w), w };
  });
}

/** INTRO → I, CHORUS 2 → C2: the short name when the full one does not fit. */
const shortName = (full: string) => full.split(' ').map((w, i) => (i === 0 ? w[0] : w)).join('');

export function barMapLayout(map: BarMap, width: number, hover: number | null = null): MapLayout {
  const empty: MapLayout = { width, barW: 0, bands: [], cells: [], ticks: [], whole: false, lit: [], litWhole: false };
  if (map.bars <= 0 || width <= 0) return empty;
  const barW = width / map.bars;
  const bands = map.sections.map((s): MapBand => {
    const [from, to] = [Math.max(1, s.from), Math.min(map.bars, s.to)];
    const [x, w] = [(from - 1) * barW, (to - from + 1) * barW];
    const full = panelName(s, map.sections);
    const text = [full, shortName(full)].find((t) => labelWidth(t) <= w) ?? null;
    return { label: s.label, occurrence: s.occurrence, from, to, x, w, text };
  });
  const room = labelWidth(String(map.bars));
  const step = STEPS.find((n) => n * barW >= room) ?? STEPS.at(-1)!;
  const ticks: MapTick[] = [];
  for (let bar = 1; bar <= map.bars; bar += step) {
    if (bar > 1 && (bar - 1) * barW + room > width) break; // the last label would run off the edge
    ticks.push({ bar, x: (bar - 1) * barW, text: String(bar) });
  }
  const cells = cellsOf(map.ops.flatMap((o) => (o.whole ? [] : o.spans)), map.bars, barW, width);
  const op = hover === null ? undefined : map.ops[hover];
  return {
    width, barW, bands, cells, ticks,
    whole: map.ops.some((o) => o.whole),
    lit: op && !op.whole ? cellsOf(op.spans, map.bars, barW, width) : [],
    litWhole: !!op?.whole,
  };
}
