/**
 * A chat turn (F-042, F-049; docs/decisions/0006): one `plan`-kind job, label `chat turn`. At its
 * turn: the song state (songStateSource) -> probe -> decideReply (each call context-checked before
 * and after, contextGuard) -> `finally` releasePlanner (keep_alive 0, then `/api/ps` empty, D-011):
 * the slot is released only when the body settles, whatever the action or the number of calls. Then
 * the reply, the draft merge and the proposal are written in one transaction. A failed or cancelled
 * turn writes one `failed` message ({reasons, cause}) and changes nothing else. C3: an `analyze` reply
 * is a READ card with its proposal; `followUp` (D-129) re-runs the origin's request after a reading,
 * writing no user message, with the REFERENCE block in the state and ask / recipe / say allowed.
 */
import crypto from 'node:crypto';
import { config } from '../../config.js';
import { db } from '../../db/index.js';
import { cancelQueued } from '../genQueue.js';
import { queueJob } from '../jobRunner.js';
import { abortJob, getJob, wasAborted, type Job } from '../jobRegistry.js';
import { songTitle } from '../queueGuards.js';
import { contextPostflight, contextPreflight } from '../score/contextGuard.js';
import { askPlanner } from '../score/plannerClient.js';
import { promptChars } from '../score/plannerPrompt.js';
import { MAX_ATTEMPTS } from '../score/planAttempts.js';
import { loadedModels, probePlanner, releasePlanner, type LoadedModel, type PlannerTarget } from '../score/ollamaControl.js';
import type { ChatMessage as PromptMessage, PlannerReply } from '../score/planTypes.js';
import { appendMessage, lastTurns } from './messageStore.js';
import { liveProposal, propose } from './proposalStore.js';
import { analyzeFor, gatherTurnState, sourceDeps, type SourceDeps, type TurnRefs } from './songStateSource.js';
import { threadById, writeDraft } from './threadStore.js';
import { decideReply, ladderRung } from './turnCall.js';
import { dispatchReply, type AnalyzeResolved } from './turnDispatch.js';
import type { ReadingPlanSources } from './reading.js';
import type { AnalyzeTarget, ChatMessage, FailedBody, TurnReply, UserBody } from './chatTypes.js';

/** Turns of conversation in the prompt (F-042 #2). */
export const HISTORY_TURNS = 4;
export type TurnCause = 'offline' | 'check' | 'context' | 'unload' | 'cancelled' | 'gone';

export class TurnError extends Error {
  constructor(readonly cause: TurnCause, message: string, readonly reasons: string[] = [message]) { super(message); }
}

export interface TurnDeps {
  planner: PlannerTarget;
  source: SourceDeps;
  probe: () => Promise<string | null>;
  ask: (messages: PromptMessage[], schema: Record<string, unknown>, signal?: AbortSignal, maxTokens?: number) => Promise<PlannerReply>;
  loaded: () => Promise<LoadedModel[]>;
  release: () => Promise<unknown>;
  rung: number;
  /** C3: where each reading step would run, for the READ card's estimate (CR-2's readingPlan; default: every service). */
  plan: (target: AnalyzeTarget) => ReadingPlanSources;
}

export function turnDeps(over: Partial<TurnDeps> = {}): TurnDeps {
  const planner = over.planner ?? { url: config.llmUrl, model: config.llmModel };
  return {
    planner, source: sourceDeps(), rung: ladderRung(),
    probe: () => probePlanner(planner),
    ask: (messages, schema, signal, maxTokens) => askPlanner(planner, messages, schema, { timeoutMs: config.llmTimeoutMs, signal, maxTokens }),
    loaded: () => loadedModels(planner),
    release: () => releasePlanner(planner),
    plan: () => ({ words: 'service', score: 'service', caption: 'service' }),
    ...over,
  };
}

/** Live turns: job id -> where its outcome is written (the cancel route's lookup). */
const turns = new Map<string, { threadId: string; messageId: string }>();
export const turnOf = (jobId: string) => turns.get(jobId);

function writeFailed(threadId: string, reasons: string[], cause: TurnCause): void {
  const body: FailedBody = { reasons, cause };
  try {
    appendMessage(threadId, { role: 'assistant', kind: 'failed', text: reasons[0] ?? cause, body });
  } catch { /* the thread is gone (NEW CHAT): nothing to write to */ }
}

/** The reply, the draft merge and the proposal: all or nothing. */
const writeReply = db.transaction((threadId: string, reply: TurnReply, sentRev: number, scoreReason: string | null, refs: TurnRefs, analyze: AnalyzeResolved | null) => {
  const now = threadById(threadId);
  if (!now) throw new TurnError('gone', 'this chat was cleared while the assistant was thinking');
  const out = dispatchReply({ reply, hasSong: Boolean(now.songId), draft: now.draft, sentRev, scoreReason, reference: refs.reading, analyze });
  if (out.kind === 'recipe' && out.draft !== now.draft && !writeDraft(threadId, now.draft.rev, out.draft).ok) {
    throw new TurnError('check', 'the draft changed while the reply was written');
  }
  const proposalId = out.kind === 'recipe' || out.kind === 'analyze' ? crypto.randomUUID() : null;
  const { message } = appendMessage(threadId, { role: 'assistant', kind: out.kind, text: out.text, body: out.body, proposalId });
  return { message, proposalId, out };
});

async function runTurn(job: Job, threadId: string, user: ChatMessage, deps: TurnDeps, signal: AbortSignal, followUp: string | null): Promise<void> {
  const thread = threadById(threadId);
  if (!thread) throw new TurnError('gone', 'this chat was cleared before the turn started');
  const attach = (user.body as UserBody | null)?.attach?.referenceId ?? null;
  const gathered = await gatherTurnState(thread, deps.source, { attach, followUp });
  const unsupported = await deps.probe();
  if (unsupported) throw new TurnError('offline', unsupported);
  const contextOf = async () => (await deps.loaded()).find((m) => m.name === deps.planner.model)?.contextLength ?? null;
  const history = lastTurns(threadId, HISTORY_TURNS + 1).filter((m) => m.seq < user.seq);
  let decision: Awaited<ReturnType<typeof decideReply>>;
  try {
    decision = await decideReply({
      state: gathered.state, block: gathered.block, facts: gathered.facts, draft: gathered.draft, request: user.text,
      pending: !thread.songId && Boolean(liveProposal(threadId)), history,
    }, {
      rung: deps.rung,
      onAttempt: (n, reason) => { job.progressText = `attempt ${n} of ${MAX_ATTEMPTS}${reason ? ` · ${reason}` : ''}`; },
      ask: async (msgs, schema, { maxTokens }) => {
        if (wasAborted(job)) throw new TurnError('cancelled', 'Aborted');
        const chars = promptChars(msgs);
        const pre = contextPreflight({ promptChars: chars, contextLength: await contextOf() });
        if (pre) throw new TurnError('context', pre);
        const reply = await deps.ask(msgs, schema, signal, maxTokens);
        const cut = contextPostflight({ promptTokens: reply.promptTokens, promptChars: chars, contextLength: await contextOf() });
        if (cut) throw new TurnError('context', cut);
        return reply;
      },
    });
  } finally {
    job.progressText = 'unloading the planner';
    await deps.release();
  }
  if (wasAborted(job)) throw new TurnError('cancelled', 'Aborted');
  if (!decision.ok) throw new TurnError('check', `no answer in ${decision.attempts} attempts: ${decision.reasons[0] ?? ''}`, decision.reasons);
  const sentRev = (user.body as UserBody | null)?.sentRev ?? thread.draft.rev;
  const r = decision.reply;
  const analyze = r.action === 'analyze' && !thread.songId ? analyzeFor(r.reference, gathered.refs, deps.plan) : null;
  const { message, proposalId, out } = writeReply(threadId, r, sentRev, gathered.scoreReason, gathered.refs, analyze);
  const at = { threadId, messageId: message.id, createdAt: Date.now() };
  if (proposalId && out.kind === 'recipe') propose({ id: proposalId, ...at, kind: 'recipe', recipe: out.body.recipe });
  if (proposalId && out.kind === 'analyze') propose({ id: proposalId, ...at, kind: 'analyze', target: out.body.target });
  job.progressText = undefined;
  job.status = 'done';
}

function causeOf(job: Job, err: unknown): TurnCause {
  if (wasAborted(job)) return 'cancelled';
  if (err instanceof TurnError) return err.cause;
  return /still loaded|ollama stop/.test(err instanceof Error ? err.message : String(err)) ? 'unload' : 'offline';
}

/** Queues the turn for `user` (already stored, body `{sentRev}`). Throws QueueFullError when full.
 * `followUp` (C3): `user` is the origin message, asked again after the reading of that reference. */
export function startChatTurn(threadId: string, user: ChatMessage, songId: string | null, deps: TurnDeps = turnDeps(), opts: { followUp?: string } = {}): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'queued', createdAt: Date.now() };
  const call = new AbortController();
  const info = { kind: 'plan' as const, label: 'chat turn', title: songId ? songTitle(songId) : 'new song chat', ...(songId ? { songId } : {}) };
  turns.set(job.id, { threadId, messageId: user.id }); // before queueJob: the body may start (and settle) inside it
  try {
    return queueJob(info, job, async () => {
      try {
        await runTurn(job, threadId, user, deps, call.signal, opts.followUp ?? null);
      } catch (err) {
        const cause = causeOf(job, err);
        const reasons = err instanceof TurnError && cause !== 'cancelled' ? err.reasons : [cause === 'cancelled' ? 'cancelled' : (err instanceof Error ? err.message : String(err))];
        writeFailed(threadId, reasons, cause);
        if (!wasAborted(job)) throw err; // an aborted turn stays failed with 'Aborted', as markAborted left it
      } finally {
        turns.delete(job.id);
      }
    }, 'running', () => call.abort());
  } catch (err) {
    turns.delete(job.id); // QueueFullError: nothing was queued
    throw err;
  }
}

/** CANCEL: queued -> out of the line, with a `cancelled` reply; thinking -> abort the call, the body
 * still unloads before the slot is released (D-041). False when the job is not a live turn. */
export function cancelTurn(jobId: string): { cancelled: true } | { aborted: true } | null {
  const turn = turns.get(jobId);
  if (!turn) return null;
  if (cancelQueued(jobId)) {
    turns.delete(jobId);
    writeFailed(turn.threadId, ['cancelled before it started'], 'cancelled');
    return { cancelled: true };
  }
  if (!abortJob(jobId)) return null;
  // Cancelled now, so a poll during the unload reads CANCELLED, not a plain failure (D-116).
  const job = getJob(jobId);
  if (job) job.cancelled = true;
  return { aborted: true };
}
