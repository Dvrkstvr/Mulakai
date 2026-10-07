/** A card's commit (moved out of `chatTurn.ts` at its cap; re-exported there): CREATE SONG's take (F-044) and, C0b,
 * APPLY's edit job (`apply`, F-047, F-049 #1). The line under the card, whose button never turns into progress. An
 * APPLY runs rendering → splicing → saving (the job's progressText, with YuE2's stage and share); its cancel puts the
 * card back to pending, saying where it stopped. Done → null: the song or version card that lands says the rest
 * (TRUNCATED included). Pure. */
import type { TurnJobPoll } from './chatTurn';

export type CommitPhase =
  | { kind: 'starting' } | { kind: 'queued'; ahead: number }
  /** `stage` / `progress`: an APPLY's YuE2 stage and its share while rendering (absent on CREATE SONG's take). */
  | { kind: 'running'; progressText: string | null; stage?: string | null; progress?: number | null }
  /** The server refused (proposal gone, blockers, a model still loaded) or the job failed: the card is live again. */
  | { kind: 'failed'; error: string }
  /** APPLY only: cancelled while `during` (rendering, splicing…); nothing saved, the card is pending again. */
  | { kind: 'cancelled'; during: string | null };
export interface CommitState { proposalId: string; jobId: string | null; phase: CommitPhase; apply?: boolean }
type CommitPoll = TurnJobPoll & { error?: string; progress?: number; progressStage?: string };
export type CommitEvent =
  | { type: 'start'; proposalId: string; apply?: boolean }
  | { type: 'started'; jobId: string }
  /** A reload found the card `committing` with its job; an edit card's `phase` is the step the server names. */
  | { type: 'restore'; proposalId: string; jobId: string; apply?: boolean; phase?: string | null }
  /** `stale`: APPLY refused because the song changed; the server marked the card STALE, so the commit ends. */
  | { type: 'refused'; error: string; stale?: boolean }
  | { type: 'poll'; job: CommitPoll };

const ABORTED = 'Aborted';
const ended = (p: CommitPhase) => p.kind === 'failed' || p.kind === 'cancelled';

function running(apply: boolean | undefined, job: Partial<CommitPoll>): CommitPhase {
  const progressText = job.progressText ?? null;
  return apply ? { kind: 'running', progressText, stage: job.progressStage ?? null, progress: job.progress ?? null } : { kind: 'running', progressText };
}

export function chatCommit(s: CommitState | null, e: CommitEvent): CommitState | null {
  const apply = (e.type === 'start' || e.type === 'restore') && e.apply ? { apply: true } : {};
  if (e.type === 'start') return s && !ended(s.phase) ? s : { proposalId: e.proposalId, jobId: null, ...apply, phase: { kind: 'starting' } };
  if (e.type === 'restore') {
    const phase = e.phase === 'queued' ? { kind: 'queued' as const, ahead: 0 } : running(e.apply, { progressText: e.phase ?? undefined });
    return { proposalId: e.proposalId, jobId: e.jobId, ...apply, phase };
  }
  if (!s) return s;
  switch (e.type) {
    case 'started': return { ...s, jobId: e.jobId, phase: { kind: 'queued', ahead: 0 } };
    case 'refused': return e.stale ? null : { ...s, jobId: null, phase: { kind: 'failed', error: e.error } };
    case 'poll': {
      const { job } = e;
      if (job.status === 'queued') return { ...s, phase: { kind: 'queued', ahead: job.queuePosition ?? 0 } };
      if (job.status === 'loading' || job.status === 'running') return { ...s, phase: running(s.apply, job) };
      // The chat's CANCEL of a running APPLY aborts the job: it ends `failed` with the registry's 'Aborted' (markAborted).
      if (s.apply && (job.cancelled || job.error === ABORTED)) {
        return { ...s, jobId: null, phase: { kind: 'cancelled', during: s.phase.kind === 'running' ? s.phase.progressText : null } };
      }
      if (job.status === 'done' || job.cancelled) return null;
      return { ...s, jobId: null, phase: { kind: 'failed', error: job.error || 'the take failed' } };
    }
  }
}
