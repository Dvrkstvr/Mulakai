/** Test data for C1's mark and analysis tests: a 16-bar reading, 2 s a bar from 1 s (the audio is 34 s long). */
import type { AnalysisView, ShownReading, StripSection } from './api/chatAnalysis';

export const DURATION = 34;

const sec = (index: number, label: string, occurrence: number, from: number, to: number, lines = 2): StripSection =>
  ({ index, label, occurrence, bars: [from, to], seconds: [1 + (from - 1) * 2, 1 + to * 2], lines, partialLines: 0 });

export const SECTIONS: StripSection[] = [
  sec(1, 'Intro', 1, 1, 2, 0), sec(2, 'Verse', 1, 3, 6), sec(3, 'Chorus', 1, 7, 10), sec(4, 'Verse', 2, 11, 14), sec(5, 'Chorus', 2, 15, 16),
];
export const READING: ShownReading = {
  versionId: 'v4', number: 4, mode: 'current', readAt: '2026-10-07T12:00:00Z',
  bars: { starts: Array.from({ length: 16 }, (_, i) => 1 + i * 2), end: 33 },
  sections: SECTIONS, barsNotShown: 0, lines: 8, transcribed: false, notRead: { words: null, score: null, bars: null },
};
export const view = (over: Partial<AnalysisView> = {}): AnalysisView => ({
  songId: 's1', versionId: 'v4', number: 4, state: { kind: 'done' }, shown: READING, lineage: null, ...over,
});
/** v5, made from v4: `moved` and `shift` as its edit reported; `shown` v5's own reading (or v4's, dimmed / hatched). */
export const v5 = (moved: boolean, shift: { atBar: number; delta: number } | null = null, shown: ShownReading | null = null): AnalysisView =>
  view({ versionId: 'v5', number: 5, shown, lineage: { fromVersionId: 'v4', moved, shift } });
