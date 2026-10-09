/**
 * CP-C4 (scope.md C4 CK-4, F-069 #6; not app code, never imported by src/): the pure part of chatCp4.ts. Per-plan
 * records -> summary -> the scope's stop lines -> summary.md. Stop lines (any one = STOP before CK-5): a saved file with
 * any differing sample outside the spans; any partial save; join LUFS excess over 1 dB on 2 of 3 songs; an edit's wall
 * time (APPLY -> saved) over 5 min; more than 3 plans falling back to the whole song for a reason other than the stated
 * plan-time rules (D-274: a card that already said "whole song" is a stated rule; an APPLY-time `rerender` is not).
 */
import type { StopLine, TurnResult } from './chatCp0Stats.js';
import type { CheckReport } from './chatCp0EditStats.js';

/** One step's row from yue-server's chain result. */
export interface StepRow {
  kind: string; bars: [number, number] | null; verdict: string | null; reason: string | null; snap_ms: number[]; gain_db: unknown;
  joins_s: number[]; length_diff_s: number | null; null_test: { samples: number; different: number } | null;
}
export interface Cp4Apply {
  outcome: 'saved' | 'failed' | 'refused' | 'timeout';
  reason?: string;
  editMs: number | null;
  handoffMs: number | null;
  /** The base layer's version count before APPLY and after the job ended (a partial save shows here). */
  versionsBefore: number;
  versionsAfter: number;
  versionId: string | null;
  label: string | null;
  /** The saved version's `params_json.splice`. */
  record: Record<string, unknown> | null;
  fallback: string | null;
  spliceId: string | null;
  verdict: string | null;
  /** 1-based step that said no (rerender), from yue-server. */
  step: number | null;
  verdictReason: string | null;
  steps: StepRow[];
  nullTest: { samples: number; different: number } | null;
  timing: Record<string, unknown> | null;
  /** Bytes in yue-server's splice job dir after the job ended, and whether its audio.wav is there. */
  tempBytes: number | null;
  audioLeft: boolean | null;
  check: CheckReport | null;
  checkError?: string;
}
export interface Cp4Card { splice: boolean; kind?: string; reason?: string; steps?: Array<{ kind: string; from_bar: number; to_bar: number; ops: number[] }> }
export interface Cp4Result {
  song: string; title: string; plan: string; mix: string;
  /** The requests sent, in order, until the reply was an edit card with 2+ ops. */
  texts: string[];
  turn: TurnResult | null;
  ops: number;
  card: Cp4Card | null;
  apply: Cp4Apply | null;
}
export type Outcome = 'chain' | 'rule' | 'fallback' | 'unsaved' | 'no-plan';

const nums = (xs: Array<number | null | undefined>) => xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
const max = (xs: number[]) => (xs.length ? Math.max(...xs) : null);
const s1 = (ms: number | null) => (ms === null ? null : Math.round(ms / 100) / 10);

export function outcomeOf(r: Cp4Result): Outcome {
  if (r.ops < 2 || !r.card) return 'no-plan';
  if (!r.apply || r.apply.outcome !== 'saved') return 'unsaved';
  if (!r.card.splice) return 'rule';
  return r.apply.record?.splice_v === 2 ? 'chain' : 'fallback';
}

export function partialSave(r: Cp4Result): boolean {
  const a = r.apply;
  if (!a) return false;
  const added = a.versionsAfter - a.versionsBefore;
  if (added > 1 || (a.outcome !== 'saved' && added > 0)) return true;
  if (r.card?.kind !== 'several' || !a.record) return false;
  if (a.record.splice_v === 2) return !Array.isArray(a.record.steps) || a.record.steps.length !== (r.card.steps?.length ?? -1);
  return !('fallback' in a.record);
}

/** The largest |LUFS step excess| over the base's own step at any join of the saved file (joins with a base counterpart). */
export function joinExcessDb(r: Cp4Result): number | null {
  return max(nums((r.apply?.check?.seams ?? []).map((s) => (s.lufs_step_excess === null ? null : Math.abs(s.lufs_step_excess)))));
}

const nullFailed = (r: Cp4Result) => (r.apply?.nullTest?.different ?? 0) > 0 || (r.apply?.check?.null_test.different ?? 0) > 0;

export interface Cp4Summary {
  plans: number; songs: string[]; outcomes: Record<Outcome, number>; nullFails: string[]; unchecked: string[]; partial: string[];
  excessSongs: string[]; editMaxS: number | null; ruleFallbacks: number; otherFallbacks: number;
}

export function summarizeCp4(rs: Cp4Result[]): Cp4Summary {
  const songs = [...new Set(rs.map((r) => r.song))];
  const outcomes: Record<Outcome, number> = { chain: 0, rule: 0, fallback: 0, unsaved: 0, 'no-plan': 0 };
  for (const r of rs) outcomes[outcomeOf(r)]++;
  return {
    plans: rs.length, songs, outcomes,
    nullFails: rs.filter(nullFailed).map((r) => r.plan),
    unchecked: rs.filter((r) => outcomeOf(r) === 'chain' && !r.apply?.check).map((r) => r.plan),
    partial: rs.filter(partialSave).map((r) => r.plan),
    excessSongs: songs.filter((s) => rs.some((r) => r.song === s && (joinExcessDb(r) ?? 0) > 1)),
    editMaxS: s1(max(nums(rs.filter((r) => r.apply?.outcome === 'saved').map((r) => r.apply?.editMs)))),
    ruleFallbacks: outcomes.rule, otherFallbacks: outcomes.fallback,
  };
}

export function cp4StopLines(s: Cp4Summary): StopLine[] {
  const nullVerdict = s.nullFails.length ? 'STOP' : s.unchecked.length || !s.outcomes.chain ? 'NO DATA' : 'PASS';
  return [
    { verdict: nullVerdict, text: `null test on the saved files: ${s.nullFails.length} failing${s.nullFails.length ? ` (${s.nullFails.join(', ')})` : ''}, ${s.outcomes.chain} chains, ${s.unchecked.length} unchecked (stop on any differing sample)` },
    { verdict: s.partial.length ? 'STOP' : 'PASS', text: `partial saves: ${s.partial.join(', ') || 'none'} (stop on any)` },
    {
      verdict: s.songs.length === 0 ? 'NO DATA' : s.excessSongs.length >= 2 ? 'STOP' : 'PASS',
      text: `join LUFS excess over 1 dB on ${s.excessSongs.length} of ${s.songs.length} songs${s.excessSongs.length ? ` (${s.excessSongs.join(', ')})` : ''} (stop on 2 of 3)`,
    },
    { verdict: s.editMaxS === null ? 'NO DATA' : s.editMaxS > 300 ? 'STOP' : 'PASS', text: `slowest multi-op edit (APPLY -> saved) ${s.editMaxS ?? '-'} s (stop over 5 min)` },
    {
      verdict: s.otherFallbacks > 3 ? 'STOP' : 'PASS',
      text: `whole-song fallbacks at APPLY ${s.otherFallbacks} of ${s.plans} (stop over 3); plan-time rule fallbacks ${s.ruleFallbacks}, unsaved ${s.outcomes.unsaved}, no multi-op plan ${s.outcomes['no-plan']}`,
    },
  ];
}

const cell = (x: unknown) => (x === null || x === undefined || x === '' ? '-' : String(x).replace(/\|/g, '/').replace(/\n/g, ' '));
const nt = (n: { samples: number; different: number } | null | undefined) => (n ? `${n.different}/${n.samples}` : null);
const cardText = (c: Cp4Card | null) => (!c ? null : c.splice ? (c.steps ?? []).map((st) => `${st.kind} ${st.from_bar}-${st.to_bar}`).join(', ') : `whole: ${c.reason}`);

export function cp4Markdown(s: Cp4Summary, rs: Cp4Result[], meta: { server: string; date: string; note?: string }): string {
  const rows = rs.map((r) => `| ${[r.title, r.plan, r.mix, r.ops, cardText(r.card), outcomeOf(r), s1(r.apply?.editMs ?? null),
    r.apply?.verdict ? `${r.apply.verdict}${r.apply.step ? ` @${r.apply.step}` : ''}${r.apply.verdictReason ? `: ${r.apply.verdictReason}` : ''}` : r.apply?.reason,
    nt(r.apply?.nullTest), r.apply?.check ? nt(r.apply.check.null_test) : r.apply?.checkError, joinExcessDb(r),
    r.apply?.tempBytes === null || r.apply?.tempBytes === undefined ? null : (r.apply.tempBytes / 1e6).toFixed(1), r.apply?.label].map(cell).join(' | ')} |`);
  const steps = rs.flatMap((r) => (r.apply?.steps ?? []).map((st, i) => `- ${r.plan} step ${i + 1}: ${st.kind} bars ${st.bars?.join('-') ?? '-'}, ${st.verdict}${st.reason ? ` (${st.reason})` : ''}, snaps ${st.snap_ms.join('/') || '-'} ms, gain ${JSON.stringify(st.gain_db)} dB, joins ${st.joins_s.join(', ') || '-'} s, length ${st.length_diff_s ?? '-'} s, null ${nt(st.null_test) ?? '-'}`));
  const seams = rs.flatMap((r) => (r.apply?.check?.seams ?? []).map((x) => `- ${r.plan} join ${x.out_s} s: step ${x.lufs_step} dB, base ${x.base_lufs_step ?? '-'} dB, excess ${x.lufs_step_excess ?? '- (no base counterpart)'}`));
  return [
    `# CP-C4, chained splices (${meta.date})`, '', `Server ${meta.server}. ${meta.note ?? ''}`.trim(), '',
    '## Stop lines', '', ...cp4StopLines(s).map((l) => `- ${l.verdict} ${l.text}`), '',
    '## Plans', '',
    '| song | plan | mix | ops | card | outcome | edit s | splice verdict | null (record) | null (saved file) | join excess dB | temp MB | label |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows, '', '## Steps (yue-server, in step order)', '', ...steps, '', '## Joins on the saved files (splice_check.py --chain)', '', ...seams, '',
  ].join('\n');
}
