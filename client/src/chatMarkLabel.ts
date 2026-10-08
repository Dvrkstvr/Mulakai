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

/** The stale warning (CS-11): what was marked, where it went if the edit said, and that nothing was sent. `tempo`: the
 * edit changed the tempo, so the old times are other music (the bars stay, re-timed once the new bars are read). */
export function staleLines(mark: RangeMark, was: number | null, now: number | null, useBars: [number, number] | null, tempo = false): string {
  const of = was === null ? '' : ` of v${was}`;
  const v = now === null ? 'the new version' : `v${now}`;
  const what = mark.bars ? barsText(mark.bars).toLowerCase() : secondsText(mark.seconds);
  if (tempo) {
    const next = useBars ? 'the bars are the same; use them once its bars are read' : 'mark again';
    return `STALE MARK · you marked ${what}${of}. ${v} changed the tempo, so the old times are other music; ${next}. Nothing was sent with the old times.`;
  }
  // C1 live B6: "they are now" only when the numbers changed (a REPEAT after the mark leaves them where they were).
  const same = useBars && mark.bars && useBars[0] === mark.bars[0] && useBars[1] === mark.bars[1];
  const where = !useBars ? `${v} moved those bars; mark again`
    : same ? `${v} moved other bars; these are still ${barsText(useBars).toLowerCase()}`
    : `${v} moved them, so they are now ${barsText(useBars).toLowerCase()}`;
  return `STALE MARK · you marked ${what}${of}. ${where}. Nothing was sent with the old bars.`;
}

/** The tag beside the snap pointer while an edge moves (MK-5, Q-118): where the edge lands and how long the mark is. */
export function snapTag(mark: RangeMark, edge: 'start' | 'end', free: boolean, songEnd: number | null): string {
  const t = mark.seconds[edge === 'start' ? 0 : 1];
  const len = `${Math.round(mark.seconds[1] - mark.seconds[0])} s`;
  if (edge === 'end' && songEnd !== null && t >= songEnd - 0.01) return `END OF SONG · ${clock(t)}`;
  if (edge === 'start' && t <= 0.01) return `START OF SONG · ${clock(t)}`;
  if (free) return `FREE · ${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')} · SNAP OFF (ALT)`;
  if (!mark.bars) return `${clock(t)} · ${len}`;
  const at = edge === 'start' ? `BAR ${mark.bars[0]}` : `END OF BAR ${mark.bars[1]}`;
  return `SNAPS TO ${at} · ${clock(t)} · ${barCount(mark.bars[1] - mark.bars[0] + 1)} · ${len}`;
}

/** A seconds-only chip (no bars read yet, D-179): what its bars wait for. */
export const chipTail = (waiting: boolean) => (waiting ? ' · BARS WHEN THE READING LANDS' : ' · NO BARS READ');
export const WHAT_IT_SEES = 'WHAT IT SEES ▾';
export const SEES_HEAD = 'WHAT THE ASSISTANT SEES';
export const SEES_NOTE = 'this turn only · from the server';
export const AS_SENT = 'AS SENT ▸';
export const SEES_LOADING = 'Fetching what the turn would send…';
export const seesFailed = (why: string) => `Couldn't fetch it: ${why}. The mark still goes with SEND.`;

/** The composer's one line (MK-6): the mark's consequence, or why SEND is held. */
export const markConsequence = (mark: RangeMark) =>
  `plans on ${mark.bars ? 'these bars' : 'this time'} only · nothing runs until you press APPLY`;
export const sendHeldLine = (useBars: [number, number] | null) =>
  `SEND IS HELD · ${useBars ? 'press USE BARS or CLEAR MARK' : 'press CLEAR MARK, then mark again'}`;

/** The frozen echo's note (MK-7): click re-marks, or why it cannot. */
export const ECHO_REMARK = 'click to mark it again';
export const echoMoved = (now: number | null) => `${now === null ? 'A NEWER VERSION' : `v${now}`} MOVED THESE BARS · text only`;

/** A version's number by its id: the playing view's, else the thread's song and version cards'. */
export function versionNumber(
  id: string, cards: Array<{ versionId: string | null; body: unknown }>, view: { versionId: string | null; number: number | null } | null,
): number | null {
  if (view?.versionId === id) return view.number;
  const n = (cards.find((c) => c.versionId === id)?.body as { number?: unknown } | null | undefined)?.number;
  return typeof n === 'number' ? n : null;
}

/** The edit card's mark line (F-055 edge): what the plan was bounded to, then the server's notes (a whole-song op, a
 * mark clamped to the score). */
export function planMarkLine(mark: { bars: [number, number] | null; seconds: [number, number]; notes: string[] }): string {
  const where = mark.bars ? `${barsText(mark.bars)} · ${secondsText(mark.seconds)}` : `${secondsText(mark.seconds)} · BARS NOT READ`;
  return [`PLANNED ON THE MARK · ${where}`, ...mark.notes].join(' · ');
}
