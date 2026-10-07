/**
 * CP-C1-ONLY pure helpers for chatCp1.ts (not app code, never imported by src/): an outside judge of a
 * marked plan's ops (independent of the server's markFit), the analysis step times from the job's progress
 * text, the summary and the stop lines of architecture.md "Test strategy (C1)" #9.
 */
import { percentile, type StopLine } from './chatCp0Stats.js';
import type { Progress } from './chatCp3Stats.js';

export type Step = 'WORDS' | 'SCORE' | 'SECTIONS';
const STEPS: Step[] = ['WORDS', 'SCORE', 'SECTIONS'];
type Bars = [number, number];
interface Facts { sections: Array<{ index: number; label: string; from_bar: number; to_bar: number }>; lyric_blocks: Array<{ index: number; tag: string; occurrence: number }> }
export interface MarkSent { bars?: Bars; seconds: Bars }

export interface AnalysisRecord {
  song: string; title: string; source: 'yue2' | 'transcribed'; trigger: 'open' | 'save'; jobId: string;
  versionId: string | null; number: number | null; audioS: number | null; status: string; error: string | null;
  queuedMs: number | null; runMs: number | null; steps: Record<Step, number | null>; plan: Record<string, string> | null;
  notRead: Record<string, string | null> | null;
  sections: Array<{ label: string; occurrence: number; bars: Bars; seconds: Bars | null }>; mibPeak: number | null; mibEnd: number | null;
  endAt: number | null;
}
export interface TurnRecord {
  song: string; id: string; role: 'after-analysis' | 'behind-apply' | 'marked' | 'no-mark'; text: string;
  /** The first turn to run after an analysis (sent at once, or queued behind it): R-031's sample. */
  afterAnalysis: boolean;
  mark: (MarkSent & { kind: string }) | null; markBars: Bars | null; postStatus: number; reason: string | null;
  action: string | null; ops: Array<Record<string, unknown>>; outside: string[]; cardNotes: string[];
  waitMs: number | null; runMs: number | null; totalMs: number | null; promptTokens: Array<number | null>;
  plannerOnGpu: boolean | null; plannerVram: string | null; vramBeforeMiB: number | null;
}
export interface ApplyRecord {
  song: string; tag: string; behind: 'running' | 'queued' | 'none'; analysisJob: string | null; postStatus: number; reason: string | null;
  waitMs: number | null; startedAfterAnalysisMs: number | null; outcome: string; editMs: number | null; versionId: string | null;
}
export interface Run { analyses: AnalysisRecord[]; turns: TurnRecord[]; applies: ApplyRecord[] }

const kindOf = (tag: string) => tag.toLowerCase().replace(/[[\]:]/g, '').trim().split(/\s+/)[0];
const out = ([a, b]: Bars) => `bars ${a}-${b}`;

/** A section-scoped or bar-valued op outside the mark; whole-song ops are allowed (D-176). */
export function opsOutside(ops: Array<Record<string, unknown>>, mark: Bars, facts: Facts | null): string[] {
  const [lo, hi] = mark;
  const sectionOf = (o: Record<string, unknown>) => {
    if (o.op === 'REPEAT' || o.op === 'CUT') return { what: `section ${String(o.section)}`, s: facts?.sections.find((x) => x.index === o.section) };
    const block = facts?.lyric_blocks.find((b) => b.index === o.block);
    const s = block && facts!.sections.filter((x) => kindOf(x.label) === kindOf(block.tag))[block.occurrence - 1];
    return { what: `block ${String(o.block)}`, s };
  };
  return ops.flatMap((o, i) => {
    const at = `op ${i + 1} ${String(o.op)}`;
    let bars: unknown[] = [];
    if (o.op === 'REHARMONIZE') bars = [o.from_bar, o.to_bar, ...(Array.isArray(o.chords) ? o.chords.map((c) => (c as { bar?: unknown }).bar) : [])];
    if (o.op === 'WRITE_PHRASE') bars = [o.start_bar];
    const bad = bars.find((n) => typeof n === 'number' && (n < lo || n > hi));
    if (bad !== undefined) return [`${at}: bar ${String(bad)} outside ${out(mark)}`];
    if (['REPEAT', 'CUT', 'REWRITE_LYRICS'].includes(String(o.op))) {
      const { what, s } = sectionOf(o);
      if (!s) return [`${at}: ${what} not found in the score's facts`];
      if (s.to_bar < lo || s.from_bar > hi) return [`${at}: ${what} (bars ${s.from_bar}-${s.to_bar}) outside ${out(mark)}`];
    }
    return [];
  });
}

/** The bars a mark covers: its own, or the bars whose spans meet its seconds (starts[i] = bar i + 1). */
export function markBarsOf(mark: MarkSent, starts: number[] | null): Bars | null {
  if (mark.bars) return mark.bars;
  if (!starts?.length) return null;
  const barAt = (t: number) => Math.max(1, starts.filter((s) => s <= t).length);
  return [barAt(mark.seconds[0]), barAt(mark.seconds[1] - 1e-3)];
}

export function analysisSteps(samples: Progress[], end: number): Record<Step, number | null> {
  const firsts = STEPS.map((s) => samples.find((p) => p.text.startsWith(s))?.t ?? null);
  return Object.fromEntries(STEPS.map((s, i) => {
    const from = firsts[i];
    return [s, from === null ? null : (firsts.slice(i + 1).find((x): x is number => x !== null) ?? end) - from];
  })) as Record<Step, number | null>;
}

export function summarize(r: Run) {
  const short = r.analyses.filter((a) => a.runMs !== null && (a.audioS ?? 0) <= 240);
  const after = r.turns.filter((t) => t.afterAnalysis);
  const marked = r.turns.filter((t) => t.role === 'marked');
  const tokens = (ts: TurnRecord[]) => ts.flatMap((t) => t.promptTokens).filter((n): n is number => n !== null);
  return {
    refused: r.applies.filter((a) => a.postStatus !== 202 || (a.outcome !== 'saved' && /analysis|stale/i.test(a.reason ?? ''))),
    behind: r.applies.filter((a) => a.behind !== 'none'),
    slowest: short.length ? Math.max(...short.map((a) => a.runMs!)) : null,
    afterRunP50: percentile(after.map((t) => t.runMs).filter((n): n is number => n !== null), 50),
    afterTotalP50: percentile(after.map((t) => t.totalMs).filter((n): n is number => n !== null), 50),
    spilled: after.filter((t) => t.plannerOnGpu === false), seen: after.filter((t) => t.plannerOnGpu !== null).length, after: after.length,
    markedCards: marked.filter((t) => t.action === 'edit').length, marked: marked.length, outside: marked.filter((t) => t.outside.length > 0),
    promptP95Marked: percentile(tokens(marked), 95), promptP95All: percentile(tokens(r.turns), 95), promptMax: Math.max(0, ...tokens(r.turns)),
  };
}
export type Summary = ReturnType<typeof summarize>;

const v = (stop: boolean, none: boolean): StopLine['verdict'] => (none ? 'NO DATA' : stop ? 'STOP' : 'PASS');
const s1 = (ms: number | null) => (ms === null ? '-' : `${(ms / 1000).toFixed(1)} s`);

export function stopLines(s: Summary): StopLine[] {
  return [
    { verdict: v(s.refused.length > 0, s.behind.length === 0), text: `commits refused because of an analysis: ${s.refused.length} of ${s.behind.length} APPLYs behind an analysis (stop on any)` },
    { verdict: v((s.slowest ?? 0) > 90_000, s.slowest === null), text: `slowest analysis of a version of 4 min or less: ${s1(s.slowest)} (stop over 90 s)` },
    { verdict: v(s.spilled.length > 0 || (s.afterRunP50 ?? 0) > 15_000, s.afterRunP50 === null), text: `planner not fully on the GPU after an analysis in ${s.spilled.length} of ${s.seen} seen; next turn p50 ${s1(s.afterRunP50)} running (${s1(s.afterTotalP50)} from SEND) (stop on any, or over 15 s)` },
    { verdict: v(s.outside.length > 1, s.marked === 0), text: `marked turns with an op outside the mark: ${s.outside.length} of ${s.marked} (${s.markedCards} edit cards) (stop over 1)` },
    { verdict: v((s.promptP95Marked ?? 0) > 6000, s.promptP95Marked === null), text: `prompt tokens p95: ${s.promptP95Marked ?? '-'} on marked turns, ${s.promptP95All ?? '-'} on all, max ${s.promptMax} (stop over 6000)` },
  ];
}

const sec = (ms: number | null | undefined) => (ms === null || ms === undefined ? '-' : (ms / 1000).toFixed(1));
const row = (cells: unknown[]) => `| ${cells.map((c) => String(c ?? '-').replace(/\|/g, '/')).join(' | ')} |`;

export function summaryMarkdown(r: Run, meta: { server: string; date: string; note: string }): string {
  const s = summarize(r);
  return [
    `# CP-C1, analysis and marks on the real machine (${meta.date})`, '', `Server ${meta.server}. ${meta.note}`, '', '## Stop lines', '',
    ...stopLines(s).map((l) => `- ${l.verdict} ${l.text}`), '', '## Analyses', '',
    row(['song', 'source', 'trigger', 'v', 'audio s', 'status', 'waited s', 'run s', 'WORDS s', 'SCORE s', 'SECTIONS s', 'plan', 'not read', 'VRAM peak / end MiB', 'sections']),
    row(Array(15).fill('---')),
    ...r.analyses.map((a) => row([a.title, a.source, a.trigger, a.number, a.audioS?.toFixed(0), a.status + (a.error ? `: ${a.error}` : ''), sec(a.queuedMs), sec(a.runMs), sec(a.steps.WORDS), sec(a.steps.SCORE), sec(a.steps.SECTIONS),
      a.plan ? Object.values(a.plan).join('/') : '-', Object.entries(a.notRead ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('; '), `${a.mibPeak ?? '-'} / ${a.mibEnd ?? '-'}`,
      a.sections.map((x) => `${x.label}${x.occurrence > 1 ? ` ${x.occurrence}` : ''} ${x.bars[0]}-${x.bars[1]}${x.seconds ? ` @${x.seconds[0].toFixed(0)}s` : ''}`).join(', ')])),
    '', '## Turns', '',
    row(['song', 'turn', 'role', 'after analysis', 'mark (bars)', 'reply', 'wait s', 'run s', 'from SEND s', 'prompt tok', 'planner', 'VRAM before', 'ops', 'outside', 'note']),
    row(Array(15).fill('---')),
    ...r.turns.map((t) => row([t.song.slice(0, 8), t.id, t.role, t.afterAnalysis ? 'yes' : '', t.mark ? `${t.mark.bars ? 'bars' : 'seconds'} ${JSON.stringify(t.markBars)}` : '', t.postStatus === 202 ? t.action : `refused ${t.postStatus}`,
      sec(t.waitMs), sec(t.runMs), sec(t.totalMs), t.promptTokens.join(' '), t.plannerVram, t.vramBeforeMiB,
      t.ops.map((o) => `${String(o.op)}${o.from_bar ? ` ${String(o.from_bar)}-${String(o.to_bar)}` : ''}${o.section ? ` S${String(o.section)}` : ''}${o.block ? ` B${String(o.block)}` : ''}${o.start_bar ? ` @${String(o.start_bar)}` : ''}`).join(', '),
      t.outside.join('; '), (t.reason ?? t.cardNotes.join('; ')).slice(0, 140)])),
    '', '## APPLY', '',
    row(['song', 'apply', 'behind an analysis', 'POST', 'reason', 'wait s (press to running)', 'started after the analysis ended s', 'outcome', 'edit s']),
    row(Array(9).fill('---')),
    ...r.applies.map((a) => row([a.song.slice(0, 8), a.tag, a.behind, a.postStatus, a.reason, sec(a.waitMs), sec(a.startedAfterAnalysisMs), a.outcome, sec(a.editMs)])), '',
  ].join('\n');
}
