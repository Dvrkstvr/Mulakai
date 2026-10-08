/** The player's reading line and strip mode (F-052, F-053; CS-3, CS-4): the server's `AnalysisView` plus the analysis
 * job's poll → `READ v4 · 9 SECTIONS · 22 LINES`, `READING v5 · QUEUED · STARTS AFTER 1 JOB`, `READING v5 · SCORE ·
 * 2 OF 3`, `COULDN'T READ v5 · <reason>` + RETRY, `TRANSCRIBED SCORE · CONTEXT AND MARKING ONLY`; the strip live, dim
 * or hatched. Only this reducer moves these states; the composer's "waits for the reading" line (Q-069) too. Pure. */
import { ANALYSIS_STEPS, type AnalysisStep, type AnalysisView } from './api/chatAnalysis';
import type { TurnJobPoll } from './chatTurn';
import { startsAfter } from './queueCopy';

export interface AnalysisState {
  view: AnalysisView | null;
  /** The analysis job's latest poll (`view.state.jobId`); cleared when a new view arrives. */
  poll: (TurnJobPoll & { error?: string }) | null;
  /** RETRY pressed and its POST in flight, or the server's refusal of it. */
  retry: { kind: 'posting' } | { kind: 'refused'; reason: string } | null;
}
export const INITIAL_ANALYSIS: AnalysisState = { view: null, poll: null, retry: null };

export type AnalysisEvent =
  | { type: 'view'; view: AnalysisView }
  | { type: 'poll'; jobId: string; job: TurnJobPoll & { error?: string } }
  | { type: 'retry' }
  | { type: 'retryStarted'; jobId: string }
  | { type: 'retryRefused'; reason: string }
  | { type: 'clear' };

const jobOf = (v: AnalysisView | null) => (v && (v.state.kind === 'queued' || v.state.kind === 'running') ? v.state.jobId : null);

export function chatAnalysis(s: AnalysisState, e: AnalysisEvent): AnalysisState {
  switch (e.type) {
    case 'view': return { view: e.view, poll: null, retry: s.retry?.kind === 'refused' ? s.retry : null };
    case 'poll': return jobOf(s.view) === e.jobId ? { ...s, poll: e.job } : s;
    case 'retry': return s.view?.state.kind === 'failed' && s.retry?.kind !== 'posting' ? { ...s, retry: { kind: 'posting' } } : s;
    case 'retryStarted':
      if (!s.view) return s;
      return { view: { ...s.view, state: { kind: 'queued', jobId: e.jobId, ahead: 0 } }, poll: null, retry: null };
    case 'retryRefused': return { ...s, retry: { kind: 'refused', reason: e.reason } };
    case 'clear': return INITIAL_ANALYSIS;
  }
}

/** The job to poll, while one is queued or running. */
export const analysisJob = (s: AnalysisState): string | null => jobOf(s.view);
/** The poll says the job ended: refetch the view (the reading landed, or it failed). */
export const analysisSettled = (s: AnalysisState): boolean =>
  !!s.poll && (s.poll.status === 'done' || s.poll.status === 'failed' || !!s.poll.cancelled);
/** A reading of the playable version is queued or running (the composer says a message waits for it, Q-069). */
export const analysisRunning = (s: AnalysisState): boolean => analysisJob(s) !== null && !analysisSettled(s);

export type StripMode = 'live' | 'dim' | 'hatched' | 'none';
/** live = the playable version's reading; dim = an older one whose edit moved no bars (still marks); hatched = bars
 * moved or the reading failed (mark by time); none = nothing read yet. */
export function stripMode(s: AnalysisState): StripMode {
  const r = s.view?.shown;
  if (!r) return s.view?.state.kind === 'failed' ? 'hatched' : 'none';
  if (r.mode === 'current') return 'live';
  return r.mode === 'dim' ? 'dim' : 'hatched';
}

export interface ReadingLine {
  text: string;
  tone: 'quiet' | 'running' | 'failed';
  /** RETRY shows (a failed reading, not while its POST is in flight). */
  retry: boolean;
  /** The second line for a transcribed score; null for YuE2's own. */
  transcribed: string | null;
}
export const TRANSCRIBED_LINE = 'TRANSCRIBED SCORE · CONTEXT AND MARKING ONLY';
const v = (n: number | null) => (n === null ? 'THIS VERSION' : `v${n}`);
const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 'S'}`;

function stepOf(s: AnalysisState): { step: AnalysisStep; note: string | null } {
  const st = s.view!.state;
  const text = s.poll?.progressText ?? (st.kind === 'running' ? st.progress : null);
  const named = ANALYSIS_STEPS.find((k) => text?.toUpperCase().startsWith(k));
  const step = named ?? (st.kind === 'running' ? st.step : null) ?? 'WORDS';
  const rest = named && text ? text.slice(named.length).replace(/^\s*·\s*/, '').trim() : '';
  return { step, note: rest || null };
}

/** The reading line under the strip; null when there is no playable version. */
export function readingLine(s: AnalysisState): ReadingLine | null {
  const view = s.view;
  if (!view?.versionId) return null;
  const r = view.shown;
  const transcribed = r?.transcribed && r.mode !== 'hatched' ? TRANSCRIBED_LINE : null;
  const st = view.state;
  const polled = s.poll;
  if (st.kind === 'failed' || (polled?.status === 'failed' && !polled.cancelled)) {
    const reason = st.kind === 'failed' ? st.reason : polled?.error ?? 'the reading failed';
    const refused = s.retry?.kind === 'refused' ? ` · RETRY refused: ${s.retry.reason}` : '';
    return { text: `COULDN'T READ ${v(view.number)} · ${reason}${refused}`, tone: 'failed', retry: s.retry?.kind !== 'posting', transcribed };
  }
  if (analysisRunning(s)) {
    const queued = polled ? polled.status === 'queued' : st.kind === 'queued';
    if (queued) {
      const ahead = polled?.queuePosition ?? (st.kind === 'queued' ? st.ahead : 0);
      return { text: `READING ${v(view.number)} · QUEUED · ${startsAfter(ahead).toUpperCase()}`, tone: 'running', retry: false, transcribed };
    }
    const { step, note } = stepOf(s);
    const k = ANALYSIS_STEPS.indexOf(step) + 1;
    const tail = note ? ` · ${note}` : '';
    return { text: `READING ${v(view.number)} · ${step} · ${k} OF ${ANALYSIS_STEPS.length}${tail}`, tone: 'running', retry: false, transcribed };
  }
  if (!r) return { text: `${v(view.number)} · NOT READ YET`, tone: 'quiet', retry: false, transcribed: null };
  const parts = [`READ ${v(r.number)}`, count(r.sections.length, 'SECTION'), count(r.lines, 'LINE')];
  if (r.linesOutside > 0) parts.push(`${count(r.linesOutside, 'LINE')} OUTSIDE THE SECTIONS`);
  if (r.notRead.words !== null) parts.push('NO WORD TIMINGS');
  if (r.barsNotShown > 0) parts.push('SCORE LONGER THAN THE AUDIO', `${count(r.barsNotShown, 'BAR')} NOT SHOWN`);
  return { text: parts.join(' · '), tone: 'quiet', retry: false, transcribed };
}

/** The composer's line while a message would queue behind the reading (Q-069); null when nothing runs. */
export function analysisWaitLine(s: AnalysisState): string | null {
  if (!analysisRunning(s)) return null;
  return `READING ${v(s.view!.number)} · a message sent now starts after it`;
}
