/** C1's mark copy (F-054, F-055; CS-7, CS-8, CS-11): the chip, the frozen echo on a sent message, the stale lines.
 * Display only: WHAT IT SEES shows the server's preview, never text built here (D-177). Pure. */
import type { RangeMark, StripSection } from './api/chatAnalysis';

/** m:ss, rounded to the second (0:57.6 reads 0:58). */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export const barsText = (bars: [number, number]) => (bars[0] === bars[1] ? `BAR ${bars[0]}` : `BARS ${bars[0]}–${bars[1]}`);
export const secondsText = (s: [number, number]) => `${clock(s[0])}–${clock(s[1])}`;
const barCount = (n: number) => `${n} BAR${n === 1 ? '' : 'S'}`;

/** `CHORUS 2`; a label that occurs once in the song has no number (`INTRO`). */
export function sectionName(s: StripSection, all: StripSection[]): string {
  const name = s.label.toUpperCase();
  return all.filter((o) => o.label === s.label).length > 1 ? `${name} ${s.occurrence}` : name;
}

/** CS-7's label: a whole section = its name; one whole section plus bars on one side = `CHORUS 1 + 2 BARS` (`2 BARS +
 * CHORUS 1` before it); across several sections = `VERSE 3 – CHORUS 2`; else the bars; seconds only = the times. */
export function markLabel(mark: RangeMark, sections: StripSection[]): string {
  if (!mark.bars) return secondsText(mark.seconds);
  const [from, to] = mark.bars;
  const touched = sections.filter((s) => s.bars[0] <= to && s.bars[1] >= from).sort((x, y) => x.bars[0] - y.bars[0]);
  const whole = touched.filter((s) => s.bars[0] >= from && s.bars[1] <= to);
  if (touched.length === 0) return barsText(mark.bars);
  if (whole.length === 1) {
    const w = whole[0];
    const [before, after] = [w.bars[0] - from, to - w.bars[1]];
    const name = sectionName(w, sections);
    if (before === 0 && after === 0) return name;
    if (before === 0) return `${name} + ${barCount(after)}`;
    if (after === 0) return `${barCount(before)} + ${name}`;
  }
  if (touched.length === 1) return barsText(mark.bars);
  return `${sectionName(touched[0], sections)} – ${sectionName(touched[touched.length - 1], sections)}`;
}

/** The label's tail: bars and seconds, without repeating what the label already says. */
function place(mark: RangeMark, label: string): string {
  const parts = [label];
  if (mark.bars && label !== barsText(mark.bars)) parts.push(barsText(mark.bars));
  if (mark.bars || label !== secondsText(mark.seconds)) parts.push(secondsText(mark.seconds));
  return parts.join(' · ');
}

/** The composer chip: `THIS: CHORUS 1 + 2 BARS · BARS 25–34 · 0:58–1:22`. */
export const chipText = (mark: RangeMark, sections: StripSection[]) => `THIS: ${place(mark, markLabel(mark, sections))}`;
/** The stale chip (rust): `THIS: CHORUS 1 + 2 BARS · STALE`. */
export const staleChipText = (mark: RangeMark, sections: StripSection[]) => `THIS: ${markLabel(mark, sections)} · STALE`;

/** The frozen echo on a sent message (CS-8): `MARKED · CHORUS 1 + 2 BARS · BARS 25–34 · 0:58–1:22` and `on v4`.
 * `sections`: the reading the mark was made on, when the server's label is absent. */
export function echoText(mark: RangeMark, versionNumber: number | null, sections: StripSection[] = []): { text: string; on: string | null } {
  const label = mark.label ?? markLabel(mark, sections);
  return { text: `MARKED · ${place(mark, label)}`, on: versionNumber === null ? null : `on v${versionNumber}` };
}

export const USE_BARS = (bars: [number, number]) => `USE ${barsText(bars)}`;
export const CLEAR_MARK = 'CLEAR MARK';
export const SEND_HELD = 'Send is held until the mark is fixed';

/** The stale warning (CS-11): what was marked, where it went if the edit said, and that nothing was sent. */
export function staleLines(mark: RangeMark, was: number | null, now: number | null, useBars: [number, number] | null): string {
  const of = was === null ? '' : ` of v${was}`;
  const v = now === null ? 'the new version' : `v${now}`;
  const what = mark.bars ? barsText(mark.bars).toLowerCase() : secondsText(mark.seconds);
  const where = useBars ? `${v} moved them, so they are now ${barsText(useBars).toLowerCase()}` : `${v} moved those bars; mark again`;
  return `STALE MARK · you marked ${what}${of}. ${where}. Nothing was sent with the old bars.`;
}
