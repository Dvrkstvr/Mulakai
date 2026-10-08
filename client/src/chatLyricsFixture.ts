/** Test data for C2's panel tests, on C1's 16-bar reading (chatMarkFixture: 2 s a bar from 1 s): Intro 1–2 (no words),
 * Verse 1 3–6, Chorus 1 7–10, Verse 2 11–14, Chorus 2 15–16, each sung section two lines, one line per two bars. */
import type { AnalysisView } from './api/chatAnalysis';
import type { LyricsPanel, PanelLine, PanelSection } from './api/chatConverge';
import { READING, view } from './chatMarkFixture';
import type { LineTimes } from './chatLyricsMark';

export const TEXT = ['[Verse]', 'v1 a', 'v1 b', '[Chorus]', 'c1 a', 'c1 b', '[Verse]', 'v2 a', 'v2 b', '[Chorus]', 'c2 a', 'c2 b'].join('\n');
const at = (textLine: number) => ({ textLine });
const ln = (n: number, text: string, textLine: number): PanelLine => ({ n, text, at: at(textLine) });
const sec = (strip: number, label: string, occurrence: number, bars: [number, number], block: number | null, lines: PanelLine[]): PanelSection =>
  ({ strip, label, occurrence, bars, seconds: [1 + (bars[0] - 1) * 2, 1 + bars[1] * 2], block, lines });

export const PANEL_SECTIONS: PanelSection[] = [
  sec(1, 'Intro', 1, [1, 2], null, []),
  sec(2, 'Verse', 1, [3, 6], 1, [ln(1, 'v1 a', 1), ln(2, 'v1 b', 2)]),
  sec(3, 'Chorus', 1, [7, 10], 2, [ln(1, 'c1 a', 4), ln(2, 'c1 b', 5)]),
  sec(4, 'Verse', 2, [11, 14], 3, [ln(1, 'v2 a', 7), ln(2, 'v2 b', 8)]),
  sec(5, 'Chorus', 2, [15, 16], 4, [ln(1, 'c2 a', 10), ln(2, 'c2 b', 11)]),
];
export const PANEL: LyricsPanel = {
  source: 'blocks', note: null, text: TEXT, facts: { bpm: 120, key: 'Am', meter: '4/4', style: 'indie pop' }, sections: PANEL_SECTIONS,
};

/** Aligned spans per text line (null for tags): each sung line two bars, chorus 2's lines one bar each. */
const span = (a: number, b: number) => ({ start: a, end: b });
export const TIMES: LineTimes = [
  null, span(5, 9), span(9, 13), null, span(13, 17), span(17, 21), null, span(21, 25), span(25, 29), null, span(29, 31), span(31, 33),
];

export const panelView = (over: Partial<AnalysisView> = {}, lyrics: LyricsPanel | null = PANEL): AnalysisView =>
  view({ shown: { ...READING, lyrics }, ...over });
