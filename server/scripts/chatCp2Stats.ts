/**
 * CP-C2-ONLY pure helpers for chatCp2.ts (not app code, never imported by src/): an outside judge of a revise card
 * (every pending op must be in the merged plan, CHANGED from, or REMOVED; compared by value, not by the server's own
 * marks alone), the summary and the stop lines of architecture.md "Test strategy (C2)" #7 (R-040).
 */
import { percentile, type StopLine } from './chatCp0Stats.js';

type Op = Record<string, unknown>;
interface SinceLike { planId: string; marks: Array<{ mark: string; was: Op | null }>; removed: Op[] }
export type Kind = 'fresh' | 'additive' | 'fewer' | 'replace' | 'over6';
export interface Judge { kept: number; changed: number; removed: number; added: number; lost: string[]; revised: boolean }
export interface TurnRecord {
  song: string; id: string; kind: Kind; text: string; marked: boolean; postStatus: number;
  /** The reply's kind ('edit', 'failed', 'say', 'ask') or 'timeout'. */
  outcome: string; reasons: string[]; attempts: number | null;
  pendingOps: number | null; mergedOps: number | null; judge: Judge | null;
  promptTokens: Array<number | null>; contextRefused: boolean; runMs: number | null;
  /** The turn ran over a live edit card (a revise turn), not a fresh plan. */
  revise: boolean;
}

const canon = (v: unknown): unknown => Array.isArray(v) ? v.map(canon)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Op)[k])])) : v;
const same = (a: unknown, b: unknown) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
export const opName = (o: Op) => `${String(o.op)}${o.from_bar !== undefined ? ` ${String(o.from_bar)}-${String(o.to_bar)}` : ''}${o.section !== undefined ? ` S${String(o.section)}` : ''}${o.block !== undefined ? ` B${String(o.block)}` : ''}${o.start_bar !== undefined ? ` @${String(o.start_bar)}` : ''}`;

/** Each pending op accounted for once: equal to a merged op, the `was` of a CHANGED one, or in REMOVED. */
export function judgeRevise(pending: Op[], card: { ops: Op[]; since?: SinceLike | null }): Judge {
  const ops = [...card.ops];
  const changedFrom = (card.since?.marks ?? []).filter((m) => m.mark === 'CHANGED' && m.was).map((m) => m.was as Op);
  const removed = [...(card.since?.removed ?? [])];
  const j: Judge = { kept: 0, changed: 0, removed: 0, added: 0, lost: [], revised: Boolean(card.since) };
  const take = (pool: Op[], p: Op) => { const i = pool.findIndex((x) => same(x, p)); if (i < 0) return false; pool.splice(i, 1); return true; };
  for (const p of pending) {
    if (take(ops, p)) j.kept += 1;
    else if (take(changedFrom, p)) j.changed += 1;
    else if (take(removed, p)) j.removed += 1;
    else j.lost.push(opName(p));
  }
  j.added = (card.since?.marks ?? []).filter((m) => m.mark === 'NEW').length;
  return j;
}

const OVER6 = /at most 6/;
/** A revise turn met its aim: an edit card, or (over-6) the named MAX_OPS refusal. */
const met = (t: TurnRecord) => t.outcome === 'edit' || (t.kind === 'over6' && t.reasons.some((r) => OVER6.test(r)));

export function summarize(turns: TurnRecord[]) {
  const rev = turns.filter((t) => t.revise && t.postStatus === 202);
  const tokens = rev.flatMap((t) => t.promptTokens).filter((n): n is number => typeof n === 'number');
  const all = turns.flatMap((t) => t.promptTokens).filter((n): n is number => typeof n === 'number');
  const additive = rev.filter((t) => t.kind === 'additive' && t.judge);
  return {
    revise: rev.length, failed: rev.filter((t) => !met(t)), contextRefused: turns.filter((t) => t.contextRefused),
    p50: percentile(tokens, 50), p95: percentile(tokens, 95), max: tokens.length ? Math.max(...tokens) : null, calls: tokens.length,
    p95All: percentile(all, 95), maxAll: all.length ? Math.max(...all) : null,
    judged: rev.filter((t) => t.judge).length, losses: rev.filter((t) => t.judge && t.judge.lost.length > 0),
    additive: additive.length, additiveDrops: additive.filter((t) => t.judge!.removed + t.judge!.lost.length > 0),
    notRevised: rev.filter((t) => t.judge && !t.judge.revised),
  };
}
export type Summary = ReturnType<typeof summarize>;

const v = (stop: boolean, none: boolean): StopLine['verdict'] => (none ? 'NO DATA' : stop ? 'STOP' : 'PASS');

export function stopLines(s: Summary): StopLine[] {
  return [
    { verdict: v(s.contextRefused.length > 0 || (s.p95 ?? 0) > 8000, s.p95 === null), text: `context refusals ${s.contextRefused.length}; prompt tokens on revise turns p50 ${s.p50 ?? '-'} p95 ${s.p95 ?? '-'} max ${s.max ?? '-'} over ${s.calls} planner calls (stop on any refusal or p95 over 8000)` },
    { verdict: v(s.losses.length > 0, s.judged === 0), text: `pending ops missing from both the merged plan and REMOVED: ${s.losses.length} of ${s.judged} revise cards${s.losses.length ? ` (${s.losses.map((t) => `${t.id}: ${t.judge!.lost.join(', ')}`).join('; ')})` : ''} (stop on any)` },
    { verdict: v(s.additive > 0 && s.additiveDrops.length / s.additive > 0.3, s.additive === 0), text: `additive revisions dropping a pending op: ${s.additiveDrops.length} of ${s.additive} (stop over 3 of 10)` },
    { verdict: v(s.revise > 0 && s.failed.length / s.revise > 2 / 12, s.revise === 0), text: `revise turns failing: ${s.failed.length} of ${s.revise} (stop over 2 of 12)` },
  ];
}

const row = (cells: unknown[]) => `| ${cells.map((c) => String(c ?? '-').replace(/\|/g, '/')).join(' | ')} |`;

export function summaryMarkdown(turns: TurnRecord[], meta: { date: string; note: string }): string {
  const s = summarize(turns);
  return [
    `# CP-C2, revise turns on the real machine (${meta.date})`, '', meta.note, '', '## Stop lines', '',
    ...stopLines(s).map((l) => `- ${l.verdict} ${l.text}`), '', `Prompt tokens on every turn (fresh plans too): p95 ${s.p95All ?? '-'}, max ${s.maxAll ?? '-'}.`, '', '## Turns', '',
    row(['song', 'turn', 'kind', 'mark', 'reply', 'attempts', 'run s', 'prompt tok', 'pending', 'merged', 'kept / changed / removed / new', 'lost', 'note']),
    row(Array(13).fill('---')),
    ...turns.map((t) => row([t.song.slice(0, 8), t.id, t.kind, t.marked ? 'yes' : '', t.postStatus === 202 ? t.outcome : `refused ${t.postStatus}`, t.attempts,
      t.runMs === null ? '-' : (t.runMs / 1000).toFixed(1), t.promptTokens.join(' '), t.pendingOps, t.mergedOps,
      t.judge ? `${t.judge.kept} / ${t.judge.changed} / ${t.judge.removed} / ${t.judge.added}${t.judge.revised ? '' : ' (no since)'}` : '-', t.judge?.lost.join(', ') || '', (t.reasons[0] ?? '').slice(0, 140)])),
    '',
  ].join('\n');
}
