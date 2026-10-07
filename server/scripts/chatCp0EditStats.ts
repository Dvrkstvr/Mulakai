/**
 * CP-C0 edit leg (scope.md CB-4, F-050 #1; not app code, never imported by src/): the pure part of
 * chatCp0Edit.ts. Per-edit records -> summary -> the scope's stop lines -> summary.md. Stop lines: turn
 * p50 > 15 s, a hand-off > 5 s (a turn's unload-to-empty or APPLY -> job running), an edit's wall time
 * (APPLY -> version saved) > 4 min, a null test failing, join LUFS excess > 1 dB on 3 of 3 songs.
 */
import { percentile, type StopLine, type TurnResult } from './chatCp0Stats.js';

export type EditKind = 'reharmonize' | 'cut' | 'repeat' | 'rewrite';
export interface Seam { out_s: number; lufs_step: number; base_lufs_step: number | null; lufs_step_excess: number | null }
/** yue-server/splice_check.py's report on the saved library file. */
export interface CheckReport { null_test: { samples: number; different: number; max_abs_diff?: number }; seams: Seam[]; length_diff_s: number }

export interface ApplyResult {
  postStatus: number;
  outcome: 'saved' | 'failed' | 'refused' | 'timeout';
  reason?: string;
  jobId?: string;
  /** APPLY pressed -> the job left the queue. */
  handoffMs: number | null;
  /** APPLY pressed -> the version saved (or the job ended). */
  editMs: number | null;
  versionId: string | null;
  number: number | null;
  label: string | null;
  whole: boolean;
  fallback: string | null;
  spliceId: string | null;
  /** yue-server's verdict and reason, when a splice ran. */
  verdict: 'ok' | 'rerender' | null;
  verdictReason: string | null;
  nullTest: { samples: number; different: number } | null;
  seams: Seam[];
  check: CheckReport | null;
  checkError?: string;
}

export interface EditResult {
  song: string;
  title: string;
  kind: EditKind;
  turn: TurnResult;
  /** The edit card's splice verdict (spliceEligibility), or null when no edit card came. */
  planned: { splice: boolean; kind?: string; from_bar?: number; to_bar?: number; reason?: string } | null;
  apply: ApplyResult | null;
}

export interface KindStats { n: number; cards: number; saved: number; spliced: number; whole: number; turnP50S: number | null; editMaxS: number | null }
export interface EditSummary {
  edits: number;
  songs: string[];
  turnP50S: number | null;
  unloadMaxMs: number | null;
  applyHandoffMaxMs: number | null;
  editMaxS: number | null;
  byKind: Record<string, KindStats>;
  nullFails: string[];
  excessSongs: string[];
}

const nums = (xs: Array<number | null | undefined>) => xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
const max = (xs: number[]) => (xs.length ? Math.max(...xs) : null);
const s1 = (ms: number | null) => (ms === null ? null : Math.round(ms / 100) / 10);

/** The largest |LUFS step excess| over the base's own step at a join (seams with a base counterpart only). */
export function joinExcessDb(e: EditResult): number | null {
  const seams = e.apply?.check?.seams ?? e.apply?.seams ?? [];
  return max(nums(seams.map((s) => (s.lufs_step_excess === null ? null : Math.abs(s.lufs_step_excess)))));
}

export const nullFailed = (e: EditResult) => (e.apply?.nullTest?.different ?? 0) > 0 || (e.apply?.check?.null_test.different ?? 0) > 0;

function kindStats(rs: EditResult[]): KindStats {
  return {
    n: rs.length, cards: rs.filter((r) => r.planned).length, saved: rs.filter((r) => r.apply?.outcome === 'saved').length,
    spliced: rs.filter((r) => r.apply?.outcome === 'saved' && !r.apply.whole).length,
    whole: rs.filter((r) => r.apply?.outcome === 'saved' && r.apply.whole).length,
    turnP50S: s1(percentile(nums(rs.map((r) => r.turn.turnMs)), 50)),
    editMaxS: s1(max(nums(rs.map((r) => r.apply?.editMs)))),
  };
}

export function summarizeEdits(results: EditResult[]): EditSummary {
  const songs = [...new Set(results.map((r) => r.song))];
  const byKind: Record<string, KindStats> = {};
  for (const k of [...new Set(results.map((r) => r.kind))]) byKind[k] = kindStats(results.filter((r) => r.kind === k));
  return {
    edits: results.length, songs,
    turnP50S: s1(percentile(nums(results.map((r) => r.turn.turnMs)), 50)),
    unloadMaxMs: max(nums(results.map((r) => r.turn.unloadMs))),
    applyHandoffMaxMs: max(nums(results.map((r) => r.apply?.handoffMs))),
    editMaxS: s1(max(nums(results.map((r) => r.apply?.editMs)))),
    byKind,
    nullFails: results.filter(nullFailed).map((r) => `${r.song} ${r.kind}`),
    excessSongs: songs.filter((s) => results.some((r) => r.song === s && (joinExcessDb(r) ?? 0) > 1)),
  };
}

export function editStopLines(s: EditSummary): StopLine[] {
  const fmt = (x: number | null) => (x === null ? 'n/a' : `${x.toFixed(1)} s`);
  const handoff = max(nums([s.unloadMaxMs, s.applyHandoffMaxMs]));
  const songsAllHot = s.songs.length >= 3 && s.excessSongs.length === s.songs.length;
  return [
    { verdict: s.turnP50S === null ? 'NO DATA' : s.turnP50S > 15 ? 'STOP' : 'PASS', text: `edit turn p50 ${fmt(s.turnP50S)} (stop over 15 s)` },
    {
      verdict: handoff === null ? 'NO DATA' : handoff > 5000 ? 'STOP' : 'PASS',
      text: `worst hand-off ${fmt(handoff === null ? null : handoff / 1000)}: unload-to-empty max ${s.unloadMaxMs ?? '-'} ms, APPLY-to-running max ${s.applyHandoffMaxMs ?? '-'} ms (stop over 5 s)`,
    },
    { verdict: s.editMaxS === null ? 'NO DATA' : s.editMaxS > 240 ? 'STOP' : 'PASS', text: `slowest edit (APPLY -> saved) ${fmt(s.editMaxS)} (stop over 4 min)` },
    { verdict: s.nullFails.length ? 'STOP' : 'PASS', text: `null test failing: ${s.nullFails.join(', ') || 'none'}` },
    {
      verdict: s.songs.length === 0 ? 'NO DATA' : songsAllHot ? 'STOP' : 'PASS',
      text: `join LUFS excess over 1 dB on ${s.excessSongs.length} of ${s.songs.length} songs${s.excessSongs.length ? ` (${s.excessSongs.join(', ')})` : ''} (stop on 3 of 3)`,
    },
  ];
}

export function editMarkdown(s: EditSummary, results: EditResult[], meta: { server: string; date: string; note?: string }): string {
  const cell = (x: unknown) => (x === null || x === undefined || x === '' ? '-' : String(x).replace(/\|/g, '/').replace(/\n/g, ' '));
  const plan = (r: EditResult) => (!r.planned ? null : r.planned.splice ? `splice ${r.planned.kind} ${r.planned.from_bar}-${r.planned.to_bar}` : `whole: ${r.planned.reason}`);
  const verdict = (a: ApplyResult | null) => (!a?.verdict ? null : a.verdictReason ? `${a.verdict}: ${a.verdictReason}` : a.verdict);
  const rows = results.map((r) => `| ${[r.title, r.kind, r.turn.action, s1(r.turn.turnMs), r.turn.unloadMs, plan(r), r.apply?.outcome, r.apply?.handoffMs,
    s1(r.apply?.editMs ?? null), verdict(r.apply), r.apply?.nullTest ? `${r.apply.nullTest.different}/${r.apply.nullTest.samples}` : null,
    r.apply?.check ? `${r.apply.check.null_test.different}/${r.apply.check.null_test.samples}` : r.apply?.checkError ?? null,
    joinExcessDb(r), r.apply?.label].map(cell).join(' | ')} |`);
  const kinds = Object.entries(s.byKind).map(([k, v]) => `- ${k}: ${v.cards}/${v.n} edit cards, ${v.saved} saved (${v.spliced} spliced, ${v.whole} whole), turn p50 ${v.turnP50S ?? '-'} s, slowest edit ${v.editMaxS ?? '-'} s`);
  return [
    `# CP-C0, edit leg (${meta.date})`, '', `Server ${meta.server}. ${meta.note ?? ''}`.trim(), '',
    '## Stop lines', '', ...editStopLines(s).map((l) => `- ${l.verdict} ${l.text}`), '',
    '## Per kind', '', ...kinds, '',
    '## Edits', '',
    '| song | kind | reply | turn s | unload ms | edit card | APPLY | hand-off ms | edit s | splice verdict | null (record) | null (saved file) | join excess dB | label |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows, '',
  ].join('\n');
}
