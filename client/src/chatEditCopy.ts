/** Every line the edit and version cards say (C0b, CB-5; pipeline/design/chat-edit.html EC-1..EC-8, F-046..F-049). The
 * chat's copy for edits lives only here (chatCopy.ts is at its cap). "a few minutes" until CP-C0 calibrates the
 * render + grid + splice (Q-103). Pure. */
import type { ChatSplice, ChatVersionBody } from './api/chatEdit';
import type { ScoreRenderMode } from './api/score';
import type { CommitPhase } from './chatTurn';
import { fmtLength } from './chatScreen';
import { queueSuffix, startsAfter } from './queueCopy';
import { renderModeClause, renderStage } from './scoreCopy';

export const EDIT_HEADER = 'EDIT · SCORE';
export const APPLY = 'APPLY';
export const PLAY = '▶ PLAY';
export const WHY_WHOLE = 'WHY THE WHOLE SONG:';
export const APPLY_FAILED = 'APPLY FAILED';
export const STALE_TITLE = 'THIS SONG CHANGED SINCE THE PROPOSAL';
export const EDIT_EXPIRED_TITLE = 'THIS EDIT EXPIRED';
export const EDIT_EXPIRED_BODY = 'when the server restarted. Ask again for a new card.';
/** A restart cut a running APPLY (F-049 #3): the plan went with the server, so the way on is a new card. */
export const editInterruptedBody = (base: number) => `The server restarted while APPLY ran. Nothing was saved, v${base} is untouched; ask again for a new card.`;
export const EDIT_SUPERSEDED_BODY = 'A newer edit card is below. This one cannot be applied.';
export const NOW_PLAYING_NEW = 'NOW PLAYING THE NEW VERSION';
export const VERSION_LABEL = 'VERSION';

/** "bars 25-32", or "bar 43" for one bar. */
const barsOf = (a: number, b: number) => (a === b ? `bar ${a}` : `bars ${a}-${b}`);
const span = (s: { from_bar: number; to_bar: number }) => barsOf(s.from_bar, s.to_bar);

export function editHeader(kind: string): string {
  const state = { committing: 'APPLYING', superseded: 'SUPERSEDED', expired: 'EXPIRED', interrupted: 'INTERRUPTED', stale: 'STALE' }[kind];
  return state ? `${EDIT_HEADER} · ${state}` : EDIT_HEADER;
}
export function editHint(kind: string, base: number, next: number): string {
  if (kind === 'committing') return `v${base} is untouched until v${next} is saved`;
  if (kind === 'superseded') return 'REPLACED BY A NEWER PLAN';
  return kind === 'pending' ? 'nothing runs yet' : '';
}

/** The bar strip's words (EC-2): the span against the bars that stay, or all of them. `total` = the song as read. */
export function stripLine(s: ChatSplice, total: number, base: number): string {
  if (!s.splice) return `ALL ${total} BARS CHANGE`;
  const one = s.from_bar === s.to_bar;
  const did = (one ? { reharmonize: 'CHANGES', cut: 'IS CUT', repeat: 'PLAYS TWICE' } : { reharmonize: 'CHANGE', cut: 'ARE CUT', repeat: 'PLAY TWICE' })[s.kind];
  return `${span(s).toUpperCase()} ${did} · THE OTHER ${total - (s.to_bar - s.from_bar + 1)} ARE v${base}`;
}

/** The consequence line left of APPLY (EC-1, EC-3; F-046 #2): only the span changes, or the whole song re-renders. */
export function editConsequence(s: ChatSplice, mode: ScoreRenderMode, base: number, next: number, ahead: number): string {
  const saves = `saves v${next}, v${base} is kept`;
  if (s.splice && s.kind === 'reharmonize') {
    return `Uses the GPU, a few minutes · re-sings ${span(s)}, instruments there may change, every other bar stays v${base}'s audio · length may differ by under 0.25 s · ${saves}${queueSuffix(ahead)}`;
  }
  if (s.splice) {
    const [verb, after] = s.kind === 'cut' ? ['Cuts', 'bars after the cut are earlier'] : ['Repeats', 'bars after the copy are later'];
    return `${verb} ${span(s)} in v${base}'s audio, every other bar stays v${base}'s audio · ${after}, so BACK TO v${base} will not line up there · ${saves}${queueSuffix(ahead)}`;
  }
  const clause = renderModeClause(mode);
  return `Uses the GPU, a few minutes · the whole song is re-rendered: every bar will sound different, not only the listed ones · instruments may change${clause ? ` · ${clause}` : ''} · ${saves}${queueSuffix(ahead)}`;
}

export type ApplyStep = 'rendering' | 'splicing' | 'saving';
/** The commit's steps (EC-4): a splice renders then splices, a CUT / REPEAT only splices, a whole song only renders. */
export function applySteps(s: ChatSplice): ApplyStep[] {
  if (!s.splice) return ['rendering', 'saving'];
  return s.kind === 'reharmonize' ? ['rendering', 'splicing', 'saving'] : ['splicing', 'saving'];
}

export interface ApplyLine { title: string; tail: string | null; waiting: boolean; cancel: boolean }
/** The one plain line under the steps; CANCEL until SAVING (a save cannot be taken back). */
export function applyJobLine(p: CommitPhase, s: ChatSplice, next: number): ApplyLine {
  const steps = applySteps(s);
  const step = p.kind === 'running' ? steps.indexOf(p.progressText as ApplyStep) : -1;
  if (p.kind === 'queued' && p.ahead > 0) return { title: `${APPLY} · QUEUED · ${startsAfter(p.ahead).toUpperCase()}`, tail: null, waiting: true, cancel: true };
  if (p.kind !== 'running' || step < 0) return { title: `${APPLY} · STARTING…`, tail: null, waiting: true, cancel: p.kind !== 'starting' };
  const tail = `step ${step + 1} of ${steps.length}`;
  if (p.progressText === 'saving') return { title: `SAVING · writing v${next} and its score`, tail, waiting: false, cancel: false };
  if (p.progressText === 'splicing') return { title: `SPLICING · ${s.splice ? span(s) : 'the bars'} into the old take`, tail, waiting: false, cancel: true };
  const stage = renderStage(p.stage ?? undefined, p.progress ?? undefined);
  return { title: `RENDERING${s.splice ? '' : ' · WHOLE SONG'} · YUE2${stage ? ` · ${stage}` : ''}`, tail, waiting: false, cancel: true };
}

/** A cancel while rendering drops YuE2's render job with its files; after a splice the render stays on yue-server
 * until its retention sweep (CB-6), so only the rendering line says it is deleted. */
export function cancelledLine(during: string | null, next: number): string {
  if (!during) return `CANCELLED · no v${next} saved`;
  return `CANCELLED WHILE ${during.toUpperCase()}${during === 'rendering' ? ' · the temporary render is deleted' : ''} · no v${next} saved`;
}
export const applyFailedBody = (error: string, base: number) => `${error}. Nothing was saved, v${base} is untouched.`;
/** STALE's body: the re-check's detail after the server's "this song changed since the proposal". */
export function staleBody(reason: string): string {
  const detail = reason.replace(/^this song changed since the proposal:?\s*/, '');
  return `${detail || 'a repaint was queued in the Editor, or another version was chosen'}. Nothing started.`;
}
export const editDoneLine = (s: ChatSplice) => `DONE · ${s.splice ? span(s).toUpperCase() : 'WHOLE SONG'}`;
export const waitingFor = (n: number) => `WAITING FOR v${n} · a message sent now is read after v${n} is saved`;

// The version card (EC-5, EC-6) and BACK TO in the player (EC-7).
const was = (v: ChatVersionBody) => (v.previous ? `v${v.previous.number}` : 'the old take');
function lengthDiff(d: number | null, v: ChatVersionBody): string | null {
  if (d === null || Math.abs(d) < 0.005) return null;
  const amount = Math.abs(d) < 1 ? `${Math.abs(d).toFixed(2)} s` : fmtLength(Math.abs(d));
  return `${amount} ${d > 0 ? 'longer' : 'shorter'}${Math.abs(d) < 1 && v.previous ? ` than v${v.previous.number}` : ''}`;
}
export const versionHint = (v: ChatVersionBody) => (v.whole && (v.fallback || v.truncated) ? 'SAVED · WHOLE SONG' : 'SAVED');
export function versionMeta(v: ChatVersionBody): string {
  const length = fmtLength(v.seconds);
  if (v.truncated) return [length, 'TRUNCATED'].filter(Boolean).join(' · ');
  if (v.splice) {
    const [a, b] = v.splice.bars;
    const did = { reharmonize: `${barsOf(a, b)} changed · the rest is ${v.previous ? `${was(v)}'s` : "the old take's"} audio`, cut: `${barsOf(a, b)} removed`, repeat: `${barsOf(a, b)} repeated` }[v.splice.kind];
    const after = { reharmonize: null, cut: 'bars after the cut are earlier', repeat: 'bars after the copy are later' }[v.splice.kind];
    return [length, did, lengthDiff(v.splice.lengthDiffS, v), after].filter(Boolean).join(' · ');
  }
  if (v.fallback) return [length, 'saved as the whole re-render, not a splice'].filter(Boolean).join(' · ');
  return [length, 'the whole song was re-rendered', `every bar sounds different from ${was(v)}`].filter(Boolean).join(' · ');
}
/** Rust, because the result is not what the card promised (D-101): an unaligned join, or a render cut short. */
export function versionWarn(v: ChatVersionBody): { title: string; body: string } | null {
  if (v.truncated) {
    return { title: `THE TAKE ENDED AT ${fmtLength(v.seconds) ?? '?'}`, body: 'YuE2 stopped early, so the whole short render was saved, not a splice.' };
  }
  if (!v.fallback) return null;
  return { title: v.fallback.toUpperCase(), body: `Every bar sounds different from ${was(v)}, not only the ones you asked for. Nothing was spliced silently.` };
}
export function versionFoot(v: ChatVersionBody, active: boolean): string {
  if (!v.previous) return 'the version before it was deleted in the Editor: no A/B';
  const p = v.previous.number;
  if (v.truncated) return `v${p} is kept and is the full-length take.`;
  if (v.fallback) return `Not what the card promised: BACK TO v${p} and USE v${p} if you prefer.`;
  if (v.splice && v.splice.kind !== 'reharmonize') return `BACK TO v${p} plays the same seconds, which no longer line up after bar ${v.splice.bars[0] - 1}.`;
  return active ? `v${v.number} is the active version. v${p} is kept.` : `v${v.number} is kept in VERSIONS.`;
}

export const backTo = (n: number) => `BACK TO v${n}`;
export const abOnLabel = (prev: number, cur: number) => `◂ v${prev} · BACK TO v${cur}`;
export const labelForUse = (n: number) => `USE v${n}`;
export const abListening = (n: number) => `v${n} · NOT ACTIVE`;
/** After USE (Q-106): the newer version stays in VERSIONS. */
export const usedLine = (n: number, kept: number) => `v${n} IS ACTIVE · v${kept} is kept in VERSIONS`;
export const USE_FAILED = 'USE FAILED';
