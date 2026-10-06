/** Every line the SCORE verb says (pipeline/design/score-verb.html, DESIGN.md "Action dock › SCORE").
 * Pure. Tempo "follows"; harmony, style and a phrase's instrument are "a request to YuE2, not a guarantee". */
import type { ScoreChord, ScoreLyricDiff, ScoreOp, ScorePlan, ScoreReading, ScoreRenderVersion } from './api';
import { fmtElapsed, fmtProgress, stageDetail } from './genProgress';
import { queueSuffix, startsAfter } from './queueCopy';
import { MAX_ATTEMPTS } from './scoreAttemptCopy';
import { followClauses, isSectionOp, REQUEST, sectionRow, wordClauses } from './scoreSectionCopy';
import type { ScorePhase } from './scoreVerbTypes';

export const REQUEST_PLACEHOLDER = 'Describe the change, e.g. jazz chords in the chorus, 88 BPM';
export const ASKING_CONSEQUENCE = 'asks the planner · uses the GPU for ~10 s · changes nothing yet';
export const CHECK_FAILED_CONSEQUENCE = 'Nothing was saved · APPLY & RENDER stays off until a plan passes every check';
export const PREVIOUS_PLAN = 'PREVIOUS PLAN · REPLACED WHEN THE NEW ONE ARRIVES';
/** The server lost the plan (a restart, D-020), seen at APPLY & RENDER or while polling. */
export const PLAN_EXPIRED = 'plan expired: the server restarted';
export const SERVER_GONE = 'the Mulakai server stopped answering';
export const CHECK_FAILED_TITLE = 'CHECK FAILED';
export const CHECK_FAILED_FIX = 'Change the request, then PLAN again.';
export const STALE_TITLE = 'PLAN OUT OF DATE';
export const STALE_TAIL = 'Nothing was started.';
export const RENDER_FAILED_TITLE = 'RENDER FAILED';
export const RENDER_FAILED_TAIL = 'nothing saved, the base is unchanged';
export const APPLY_OFF = 'a plan must pass every check first';
export { checksSegments, refusedLines, type Segment } from './scoreAttemptCopy';
export { diffNote, diffRows, type DiffRow } from './scoreSectionCopy';
export { fillLabel, fillRequest, limitHint, type LimitHint } from './scoreLimitHint';
export * from './scoreReferentCopy'; export * from './scoreReviseCopy'; // F-032, F-033
/** Ends an ACE-Step edit's consequence line while SCORE is open (F-027, D-030; scoreEnds.ts). */
export const SCORE_ENDS = 'score editing ends after this edit, SCORE will be off for this song';

const n = (v: number) => Math.round(v).toLocaleString('en-US');
const bars = (from: number, to: number) => (from === to ? `bar ${from}` : `bars ${from}–${to}`);

export const readingLine = (r: ScoreReading) =>
  `${r.bars} bars · ${r.meter} · Q:${r.bpm} · key ${r.key} · est ${n(r.seconds)} s${r.tokens === null ? '' : ` · ${n(r.tokens)} tokens`}`;

export const chordName = (c: ScoreChord) => `${c.root}${c.quality === 'maj' ? '' : c.quality}${c.bass ? `/${c.bass}` : ''}`;

const tags = (style: string) => style.split(',').map((t) => t.trim()).filter((t) => t && !/^\d+\s*bpm$/i.test(t));

const STYLE_SHOWN = 80;
const clip = (text: string) => (text.length > STYLE_SHOWN ? `${text.slice(0, STYLE_SHOWN - 1).trimEnd()}…` : text);

/** "+ jazz · − dark pop": the style's comma tags added and removed (its bpm follows the tempo).
 * A prose style, or a rewrite of most tags, reads as the new style instead: `→ jazz trio, …`. */
function styleDiff(before: string | null, after: string): string {
  const whole = `→ ${clip(after)}`;
  if (before === null) return whole;
  const had = new Set(tags(before).map((t) => t.toLowerCase()));
  const has = new Set(tags(after).map((t) => t.toLowerCase()));
  const added = tags(after).filter((t) => !had.has(t.toLowerCase())).map((t) => `+ ${t}`);
  const removed = tags(before).filter((t) => !has.has(t.toLowerCase())).map((t) => `− ${t}`);
  const diff = [...added, ...removed];
  if (diff.length === 0 || diff.length > 4 || diff.some((d) => d.length > 32)) return whole;
  return diff.join(' · ');
}

/** `note`: a section op's lyric note (F-030 #3); `diff`: a REWRITE LYRICS's OLD / NEW lines (F-031 #1). */
export interface OpRow {
  ok: boolean; name: string; detail: string; tag: 'follows' | 'a request'; reason: string | null; note: string | null; diff: ScoreLyricDiff | null;
}
type Row = Pick<OpRow, 'name' | 'detail' | 'tag'>;
type Phrase = Extract<ScoreOp, { op: 'WRITE_PHRASE' }>;
const phraseBars = (op: Phrase) => bars(op.start_bar, op.start_bar + op.bars.length - 1);
const names = (style: string | null, what: string) => (style ?? '').toLowerCase().includes(what.toLowerCase());

/** "sax · bars 57–60 · 4 bars · style + sax": yue-server appends the instrument once, after the ops, to `before`. */
function phraseDetail(op: Phrase, before: string | null, after: string): string {
  const added = !names(before, op.instrument) && names(after, op.instrument) ? ` · style + ${op.instrument}` : '';
  return `${op.instrument} · ${phraseBars(op)} · ${op.bars.length} bar${op.bars.length === 1 ? '' : 's'}${added}`;
}

function opRow(op: ScoreOp, i: number, plan: ScorePlan, baseStyle: string | null, fromBpm: number | null, key: string | null): Row {
  if (isSectionOp(op)) return sectionRow(op, plan, i, key);
  if (op.op === 'SET_TEMPO') return { name: 'SET TEMPO', detail: `${fromBpm ?? '?'} → ${op.bpm} BPM · whole song`, tag: 'follows' };
  if (op.op === 'REHARMONIZE') {
    return { name: 'REHARMONIZE', detail: `${bars(op.from_bar, op.to_bar)} · ${op.chords.map(chordName).join(' ')}`, tag: 'a request' };
  }
  if (op.op === 'WRITE_PHRASE') {
    const edited = [...plan.ops].reverse().find((o) => o.op === 'EDIT_STYLE');
    return { name: 'WRITE PHRASE', detail: phraseDetail(op, edited?.op === 'EDIT_STYLE' ? edited.style : baseStyle, plan.style), tag: 'a request' };
  }
  return { name: 'EDIT STYLE', detail: styleDiff(baseStyle, op.style), tag: 'a request' };
}

/** `fromKey` is the base's key, for TRANSPOSE's "Am → Gm". */
export const opRows = (plan: ScorePlan, baseStyle: string | null, fromBpm: number | null, fromKey: string | null = null): OpRow[] =>
  plan.ops.map((op, i, _, v = plan.verdicts[i]) => ({
    ok: v?.ok !== false, ...opRow(op, i, plan, baseStyle, fromBpm, fromKey), reason: v?.reason ?? null, note: v?.note ?? null, diff: v?.diff ?? null,
  }));

/** A rejected op stays in the list with its reason, never dropped. */
export const rowDetail = (r: OpRow) => (r.ok || !r.reason ? r.detail : `${r.detail} · rejected: ${r.reason}`);

export const planHeader = (plan: ScorePlan, baseVersion: number | null | undefined) =>
  `PLAN · ${plan.ops.length} CHANGE${plan.ops.length === 1 ? '' : 'S'}${baseVersion ? ` · AGAINST BASE v${baseVersion}` : ''}`;

/** "Saves base v3 · re-renders the whole song on YuE2, about 3 min · every bar will sound different
 * · tempo follows 88 BPM · harmony in bars 17–24 is a request to YuE2, not a guarantee · v2 stays in VERSIONS". */
export function consequenceLine(
  plan: ScorePlan, v: { baseVersion?: number | null; versions?: number; reading?: { key: string } | null }, ahead: number,
): string {
  const next = (v.versions ?? 0) + 1;
  const length = plan.checks.seconds === null ? '' : `, about ${Math.max(1, Math.round(plan.checks.seconds / 60))} min`;
  const parts = [`Saves base v${next}`, `re-renders the whole song on YuE2${length}`, 'every bar will sound different'];
  const requests: string[] = [], phrases: string[] = [];
  for (const op of plan.ops) {
    if (op.op === 'SET_TEMPO') parts.push(`tempo follows ${op.bpm} BPM`);
    if (op.op === 'REHARMONIZE') requests.push(`harmony in ${bars(op.from_bar, op.to_bar)}`);
    if (op.op === 'EDIT_STYLE' && !requests.includes('the style change')) requests.push('the style change');
    if (op.op === 'WRITE_PHRASE') phrases.push(`the ${op.instrument} phrase replaces the instrument part in ${phraseBars(op)} and is ${REQUEST}`);
  }
  parts.push(...followClauses(plan, v.reading?.key ?? null));
  const listed = requests.length > 1 ? `${requests.slice(0, -1).join(', ')} and ${requests.at(-1)}` : requests[0];
  if (listed) parts.push(`${listed} ${requests.length === 1 ? 'is' : 'are'} ${REQUEST}`);
  parts.push(...phrases, ...wordClauses(plan));
  if (v.baseVersion) parts.push(`v${v.baseVersion} stays in VERSIONS`);
  return parts.join(' · ') + queueSuffix(ahead);
}

/** The job line under the commit: dashed while queued, on the AI shader while the planner or YuE2
 * works. A render names YuE2's stage and that stage's share, then the time since it started. */
export function jobLine(phase: ScorePhase, elapsedMs = 0): string {
  if (phase.kind === 'queued') return `PLANNING · QUEUED · ${startsAfter(phase.ahead).toUpperCase()}`;
  if (phase.kind === 'planning') {
    if (phase.cancelling) return 'CANCELLING… unloading the planner before the GPU is free';
    return `PLANNING… attempt ${phase.attempt} of ${MAX_ATTEMPTS}${phase.note ? ` · ${phase.note}` : ''}`;
  }
  if (phase.kind === 'renderQueued') return `RENDERING · QUEUED · ${startsAfter(phase.ahead).toUpperCase()}`;
  if (phase.kind === 'rendering') return `RENDERING · ${phase.line || 'starting'}${elapsedMs > 0 ? ` · ${fmtElapsed(elapsedMs)}` : ''}`;
  return '';
}

/** "synthesizing audio 41%": the stage's readable name and its share (DESIGN.md's YuE2 rule). */
export const renderStage = (stage?: string, progress?: number) =>
  [stageDetail(stage), stageDetail(stage) ? fmtProgress(progress) : null].filter(Boolean).join(' ');

const clock = (seconds: number | null) => (seconds === null ? null : fmtElapsed(seconds * 1000));

/** DONE in lilac, or TRUNCATED in rust: saved and revertible, but never "done" (D-025). */
export function savedLine(v: ScoreRenderVersion): string {
  const length = clock(v.seconds);
  if (v.truncated) {
    return `TRUNCATED${length ? ` at ${length}` : ''}, the song is cut short — v${v.number} is saved; revert in VERSIONS or shorten and re-render`;
  }
  const facts = [v.bpm === null ? null : `${v.bpm} BPM`, length].filter(Boolean).join(', ');
  return `Saved base v${v.number}${facts ? ` · ${facts}` : ''}`;
}

export function offlineLines(phase: Extract<ScorePhase, { kind: 'offline' }>): { title: string; body: string; fix: string } {
  if (phase.source === 'checker') return { title: 'SCORE CHECKER OFFLINE', body: phase.reason, fix: 'Request kept, nothing saved.' };
  const start = /^planner offline/.test(phase.reason) ? 'Start Ollama, then RECHECK.' : 'Then RECHECK.';
  return { title: 'PLANNER OFFLINE', body: phase.reason, fix: `${start} Request kept, nothing saved, GPU free.` };
}
