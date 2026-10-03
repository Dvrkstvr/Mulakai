/** Every line the SCORE verb says (pipeline/design/score-verb.html, DESIGN.md "Action dock ›
 * SCORE"). Pure. Tempo "follows"; harmony and style are "a request to YuE2, not a guarantee". */
import type { ScoreChord, ScoreOp, ScorePlan, ScoreReading, ScoreRenderVersion } from './api';
import { fmtElapsed, fmtProgress, stageDetail } from './genProgress';
import { queueSuffix, startsAfter } from './queueCopy';
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
const LIMIT_SECONDS = 360;
const WARN_SECONDS = 330;
const TOKEN_LIMIT = 4096;
const MAX_ATTEMPTS = 3;

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

export interface OpRow { ok: boolean; name: string; detail: string; tag: 'follows' | 'a request'; reason: string | null }

function opRow(op: ScoreOp, baseStyle: string | null, fromBpm: number | null): Omit<OpRow, 'ok' | 'reason'> {
  if (op.op === 'SET_TEMPO') return { name: 'SET TEMPO', detail: `${fromBpm ?? '?'} → ${op.bpm} BPM · whole song`, tag: 'follows' };
  if (op.op === 'REHARMONIZE') {
    return { name: 'REHARMONIZE', detail: `${bars(op.from_bar, op.to_bar)} · ${op.chords.map(chordName).join(' ')}`, tag: 'a request' };
  }
  return { name: 'EDIT STYLE', detail: styleDiff(baseStyle, op.style), tag: 'a request' };
}

export const opRows = (plan: ScorePlan, baseStyle: string | null, fromBpm: number | null): OpRow[] =>
  plan.ops.map((op, i) => ({ ok: plan.verdicts[i]?.ok !== false, ...opRow(op, baseStyle, fromBpm), reason: plan.verdicts[i]?.reason ?? null }));

/** A rejected op stays in the list with its reason, never dropped. */
export const rowDetail = (r: OpRow) => (r.ok || !r.reason ? r.detail : `${r.detail} · rejected: ${r.reason}`);

export const planHeader = (plan: ScorePlan, baseVersion: number | null | undefined) =>
  `PLAN · ${plan.ops.length} CHANGE${plan.ops.length === 1 ? '' : 'S'}${baseVersion ? ` · AGAINST BASE v${baseVersion}` : ''}`;

export interface Segment { text: string; warn: boolean }

/** The one checks line; a segment past its limit (330 s and up, over 4,096 tokens) turns rust. */
export function checksSegments(c: ScorePlan['checks'], attempts: number): Segment[] {
  const out: Segment[] = [{ text: `${c.bars} bars`, warn: false }];
  if (c.seconds !== null) out.push({ text: `est ${n(c.seconds)} s of ${LIMIT_SECONDS} s`, warn: c.seconds > WARN_SECONDS });
  if (c.tokens !== null) out.push({ text: `${n(c.tokens)} of ${n(TOKEN_LIMIT)} tokens`, warn: c.tokens > TOKEN_LIMIT });
  if (c.chordsPresent !== null) out.push({ text: c.chordsPresent ? 'chords valid' : 'chords invalid', warn: !c.chordsPresent });
  out.push({ text: `attempt ${attempts} of ${MAX_ATTEMPTS}`, warn: false });
  return out;
}

/** "Saves base v3 · re-renders the whole song on YuE2, about 3 min · every bar will sound different
 * · tempo follows 88 BPM · harmony in bars 17–24 is a request to YuE2, not a guarantee · v2 stays in VERSIONS". */
export function consequenceLine(plan: ScorePlan, v: { baseVersion?: number | null; versions?: number }, ahead: number): string {
  const next = (v.versions ?? 0) + 1;
  const length = plan.checks.seconds === null ? '' : `, about ${Math.max(1, Math.round(plan.checks.seconds / 60))} min`;
  const parts = [`Saves base v${next}`, `re-renders the whole song on YuE2${length}`, 'every bar will sound different'];
  const requests: string[] = [];
  for (const op of plan.ops) {
    if (op.op === 'SET_TEMPO') parts.push(`tempo follows ${op.bpm} BPM`);
    if (op.op === 'REHARMONIZE') requests.push(`harmony in ${bars(op.from_bar, op.to_bar)}`);
    if (op.op === 'EDIT_STYLE' && !requests.includes('the style change')) requests.push('the style change');
  }
  if (requests.length) parts.push(`${requests.join(' and ')} ${requests.length === 1 ? 'is' : 'are'} a request to YuE2, not a guarantee`);
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
