/** The lyrics panel's rows (F-056, F-057; chat-lyrics.html LY-3, LY-4, LY-6; D-217, D-218, D-222): the analysis view's
 * `shown.lyrics`, the mark, the YuE2 lines' times and the live edit card's lyric diffs in, rows out. No mark → the
 * section list; a mark → only the marked part: one section whole (a marked line tinted), several each under its
 * header, a part-marked one listing its marked lines and counting the rest (all of them when its lines are untimed);
 * a pending REWRITE LYRICS as old struck above new, outside the mark appended in song order as PROPOSED. Never follows
 * playback, never edits words. Pure. */
import type { ChatMessageView } from './api/chat';
import type { AnalysisView, RangeMark } from './api/chatAnalysis';
import type { PanelSection } from './api/chatConverge';
import type { ChatEditBody } from './api/chatEdit';
import type { ScoreLyricDiff } from './api/score';
import { lineBars, usableBars } from './chatMark';
import { lineSeconds, type LineTimes } from './chatLyricsMark';

/** `text` null: the rewrite drops the line; `old` set: the line's words before the pending rewrite (struck). */
export interface LineRow { n: number; text: string | null; old: string | null; seconds: [number, number] | null; bar: number | null; marked: boolean }
/** `markedBars`: how many of its bars the mark holds when it holds only part of it (null: whole, or by seconds). */
export interface PartRow {
  section: PanelSection; whole: boolean; markedBars: number | null; lines: LineRow[]; more: number; untimed: boolean; proposed: boolean;
}
export interface ListRow { section: PanelSection; count: number; first: string | null; proposed: boolean }
/** `dim`: a newer reading runs (the old panel stays, dimmed); `version`: the playable version's number. */
interface Shown { dim: boolean; version: number | null; note: string | null }
export type PanelRows =
  | { kind: 'waiting'; version: number | null }
  | { kind: 'failed'; version: number | null; reason: string }
  | { kind: 'none'; note: string | null }
  | (Shown & { kind: 'list'; rows: ListRow[]; lines: number })
  /** `lines`: lines listed in the marked parts; `markedLines`: one part-marked section's tinted lines, else null. */
  | (Shown & { kind: 'marked'; parts: PartRow[]; lines: number; markedLines: number | null });

export interface PanelInput { view: AnalysisView | null; mark: RangeMark | null; times: LineTimes | null; diffs: ScoreLyricDiff[] }

const EPS = 1e-3;
const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] - EPS && a[1] > b[0] + EPS;
const inside = (a: [number, number], b: [number, number]) => a[0] >= b[0] - EPS && a[1] <= b[1] + EPS;

/** The REWRITE LYRICS diffs of the latest edit card while it is pending (D-222: until APPLY, superseded, stale, expired). */
export function liveDiffs(messages: ChatMessageView[]): ScoreLyricDiff[] {
  const card = messages.filter((m) => m.kind === 'edit').at(-1);
  if (!card || card.state !== 'pending' || !card.body) return [];
  return ((card.body as unknown as ChatEditBody).verdicts ?? []).flatMap((v) => (v.diff ? [v.diff] : []));
}

/** How the mark meets a section: by bars when the mark has them, else by seconds; null when it misses. */
function meet(s: PanelSection, mark: RangeMark): { whole: boolean; bars: number | null } | null {
  if (mark.bars) {
    if (!overlaps([s.bars[0] - 0.5, s.bars[1] + 0.5], [mark.bars[0] - 0.5, mark.bars[1] + 0.5])) return null;
    const whole = inside(s.bars, mark.bars);
    return { whole, bars: whole ? null : Math.min(s.bars[1], mark.bars[1]) - Math.max(s.bars[0], mark.bars[0]) + 1 };
  }
  if (!s.seconds || !overlaps(s.seconds, mark.seconds)) return null;
  return { whole: inside(s.seconds, mark.seconds), bars: null };
}

function lineRows(input: PanelInput, s: PanelSection, mark: RangeMark | null, diff: ScoreLyricDiff | undefined): LineRow[] {
  const bars = usableBars(input.view);
  const rows: LineRow[] = s.lines.map((l) => {
    const seconds = lineSeconds(l, input.times);
    const mid = seconds ? (seconds[0] + seconds[1]) / 2 : null;
    const marked = !!mark && mid !== null && mid >= mark.seconds[0] - EPS && mid <= mark.seconds[1] + EPS;
    // The number beside the line is its chip's first bar (C2 live B5): one rule, `lineBars`.
    return { n: l.n, text: l.text, old: null, seconds, bar: bars && seconds ? lineBars(bars, seconds)[0] : null, marked };
  });
  if (!diff) return rows;
  const n = Math.max(diff.old.length, diff.new.length, rows.length);
  return Array.from({ length: n }, (_, i) => {
    const base = rows[i] ?? { n: i + 1, text: null, old: null, seconds: null, bar: null, marked: false };
    const [was, now] = [diff.old[i] ?? base.text, diff.new[i] ?? null];
    return { ...base, text: now, old: was !== null && was !== now ? was : null };
  });
}

export function panelRows(input: PanelInput): PanelRows {
  const { view, mark, diffs } = input;
  const version = view?.number ?? null;
  if (view?.state.kind === 'failed') return { kind: 'failed', version, reason: view.state.reason };
  if (!view?.shown) return { kind: 'waiting', version };
  const lyrics = view.shown.lyrics;
  if (!lyrics || lyrics.source === 'none') return { kind: 'none', note: lyrics?.note ?? null };
  const shown: Shown = { dim: view.state.kind === 'queued' || view.state.kind === 'running', version, note: lyrics.note };
  const diffOf = (s: PanelSection) => (s.block === null ? undefined : diffs.find((d) => d.block === s.block));
  const sections = lyrics.sections;
  if (!mark) {
    const rows = sections.map((s) => ({ section: s, count: s.lines.length, first: s.lines[0]?.text ?? null, proposed: !!diffOf(s) }));
    // The total is the reading line's (D-197, C2 live B4): a line across a section edge sits in both rows, counted once.
    return { ...shown, kind: 'list', rows, lines: view.shown.lines };
  }
  const met = sections.flatMap((s) => { const m = meet(s, mark); return m ? [{ s, ...m }] : []; });
  const single = met.length === 1;
  const parts: PartRow[] = met.map(({ s, whole, bars }) => {
    const all = lineRows(input, s, whole ? null : mark, diffOf(s));
    const untimed = !whole && s.lines.some((l) => !lineSeconds(l, input.times));
    const lines = whole || single || untimed ? all : all.filter((l) => l.marked);
    return { section: s, whole, markedBars: bars, lines: untimed ? lines.map((l) => ({ ...l, marked: false })) : lines,
      more: all.length - lines.length, untimed, proposed: false };
  });
  const proposed = sections.filter((s) => diffOf(s) && !met.some((m) => m.s === s))
    .map((s): PartRow => ({ section: s, whole: false, markedBars: null, lines: lineRows(input, s, null, diffOf(s)), more: 0, untimed: false, proposed: true }));
  const one = single && !parts[0].whole && !parts[0].untimed ? parts[0].lines.filter((l) => l.marked).length : null;
  return { ...shown, kind: 'marked', parts: [...parts, ...proposed], lines: parts.reduce((n, p) => n + p.lines.length, 0), markedLines: one };
}
