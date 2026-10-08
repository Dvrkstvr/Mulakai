/**
 * A chat turn (F-042, F-049; docs/decisions/0006): one `plan`-kind job, label `chat turn`. At its
 * turn: the song state (songStateSource) -> probe -> decideReply (each call context-checked before
 * and after against the asked model's context, contextGuard) -> `finally` every model the turn touched
 * unloaded, then `/api/ps` empty (D-011, D-233): the slot is released only when the body settles, whatever
 * the action or the number of calls. LD: a recipe's lyrics call may run on another model (gemma4 for
 * German); turnModels unloads the planner and reads `/api/ps` empty before that model loads. Then
 * the reply, the draft merge and the proposal are written in one transaction. A failed or cancelled
 * turn writes one `failed` message ({reasons, cause}) and changes nothing else. C3: an `analyze` reply
 * is a READ card with its proposal; `followUp` (D-129) re-runs the origin's request after a reading,
 * writing no user message, with the REFERENCE block in the state and ask / recipe / say allowed.
 * C0b (CB-2): on an eligible song an edit's ops are applied on yue-server inside the same slot
 * (replyCheck), and the card's plan goes to planStore only after the card is written. C2 (F-058, D-227): a
 * live edit card over the song's unchanged pending plan (turnRevise.pendingFor, at the turn's start) makes the
 * turn's edit a revise; the card is plan n+1 with `since`. A failed turn leaves the card and the plan as they are.
 */
import crypto from 'node:crypto';
import { config } from '../../config.js';
import { cancelQueued } from '../genQueue.js';
import { queueJob } from '../jobRunner.js';
import { abortJob, getJob, wasAborted, type Job } from '../jobRegistry.js';
import { songTitle } from '../queueGuards.js';
import { contextPostflight, contextPreflight } from '../score/contextGuard.js';
import { askPlanner } from '../score/plannerClient.js';
import { promptChars } from '../score/plannerPrompt.js';
import { MAX_ATTEMPTS } from '../score/planAttempts.js';
import { loadedModels, probePlanner, releaseModels, type LoadedModel, type PlannerTarget } from '../score/ollamaControl.js';
import type { ApplyResult, ChatMessage as PromptMessage, Op, PlannerReply } from '../score/planTypes.js';
import { applyOps, type ApplyBase } from '../score/yueScoreApply.js';
import { lastTurns } from './messageStore.js';
import { liveProposal } from './proposalStore.js';
import { planFor } from './readTarget.js';
import { analyzeFor, gatherTurnState, sourceDeps, type SourceDeps } from './songStateSource.js';
import { threadById } from './threadStore.js';
import { pendingFor } from './turnRevise.js';
import { decideReply, ladderRung } from './turnCall.js';
import { lyricsModelFor } from './lyricsModels.js';
import { modelSession, shortModel } from './turnModels.js';
import type { EditResolved } from './turnDispatch.js';
import { causeOf, commitReply, TurnError, writeFailed } from './turnOutcome.js';
import type { ReadingPlanSources } from './reading.js';
import type { AnalyzeTarget, ChatMessage, EditBase, UserBody } from './chatTypes.js';

/** Turns of conversation in the prompt (F-042 #2). */
export const HISTORY_TURNS = 4;
export { TurnError, type TurnCause } from './turnOutcome.js';
export interface TurnDeps {
  planner: PlannerTarget;
  source: SourceDeps;
  /** `model` absent = the planner's. */
  probe: (model?: string) => Promise<string | null>;
  ask: (messages: PromptMessage[], schema: Record<string, unknown>, signal?: AbortSignal, maxTokens?: number, model?: string) => Promise<PlannerReply>;
  loaded: () => Promise<LoadedModel[]>;
  /** Unload `models` (absent = the planner), then wait for `/api/ps` empty. */
  release: (models?: string[]) => Promise<unknown>;
  /** LD (D-235): the lyrics model for a recipe's language. */
  lyricsModel: (language: string) => string;
  rung: number;
  /** C3: where each reading step would run, for the READ card's estimate (readTarget.planFor over CR-2's readingPlan). */
  plan: (target: AnalyzeTarget) => ReadingPlanSources;
  /** C0b: yue-server's apply of an edit's ops to the song's score (the score agent's own). */
  applyEdit: (base: ApplyBase, ops: Op[]) => Promise<ApplyResult>;
}

export function turnDeps(over: Partial<TurnDeps> = {}): TurnDeps {
  const planner = over.planner ?? { url: config.llmUrl, model: config.llmModel };
  return {
    planner, source: sourceDeps(), rung: ladderRung(),
    probe: (model = planner.model) => probePlanner({ url: planner.url, model }),
    ask: (messages, schema, signal, maxTokens, model = planner.model) =>
      askPlanner({ url: planner.url, model }, messages, schema, { timeoutMs: config.llmTimeoutMs, signal, maxTokens }),
    loaded: () => loadedModels(planner),
    release: (models = [planner.model]) => releaseModels(planner.url, models),
    lyricsModel: (language) => lyricsModelFor(language, process.env, planner.model),
    plan: (target) => planFor(target),
    applyEdit: (base, ops) => applyOps(base, ops),
    ...over,
  };
}

/** Live turns: job id -> where its outcome is written (the cancel route's lookup). */
const turns = new Map<string, { threadId: string; messageId: string }>();
export const turnOf = (jobId: string) => turns.get(jobId);

const isBase = (e: EditBase | { reason: string } | null): e is EditBase => Boolean(e && 'songId' in e);

async function runTurn(job: Job, threadId: string, user: ChatMessage, deps: TurnDeps, signal: AbortSignal, followUp: string | null): Promise<void> {
  const thread = threadById(threadId);
  if (!thread) throw new TurnError('gone', 'this chat was cleared before the turn started');
  const body = user.body as UserBody | null;
  const gathered = await gatherTurnState(thread, deps.source, { attach: body?.attach?.referenceId ?? null, followUp, mark: body?.mark ?? null });
  const mark = gathered.mark && 'stale' in gathered.mark ? null : gathered.mark;
  // C1 (D-175): a mark that went stale while the turn queued ends it here, before the planner loads.
  if (gathered.mark && 'stale' in gathered.mark) throw new TurnError('stale', `${gathered.mark.stale} · nothing changed · mark again`);
  const unsupported = await deps.probe();
  if (unsupported) throw new TurnError('offline', unsupported);
  const models = modelSession({ probe: (m) => deps.probe(m), loaded: deps.loaded, release: (m) => deps.release(m) }, deps.planner.model);
  const aborted = () => { if (wasAborted(job)) throw new TurnError('cancelled', 'Aborted'); };
  const history = lastTurns(threadId, HISTORY_TURNS + 1).filter((m) => m.seq < user.seq);
  const base = isBase(gathered.edit) ? gathered.edit : null;
  const revise = base ? pendingFor(threadId, base.songId, base.source.fingerprint) : null;
  let decision: Awaited<ReturnType<typeof decideReply>>;
  try {
    decision = await decideReply({
      state: gathered.state, block: gathered.block, facts: gathered.facts, draft: gathered.draft, request: user.text,
      pending: !thread.songId && Boolean(liveProposal(threadId)), history, mark, revise,
    }, {
      rung: deps.rung,
      apply: base ? (ops) => deps.applyEdit({ abc: base.source.abc, style: base.source.style, lyrics: base.source.lyrics }, ops) : undefined,
      onAttempt: (n, reason) => { job.progressText = `attempt ${n} of ${MAX_ATTEMPTS}${reason ? ` · ${reason}` : ''}`; },
      lyricsModel: deps.lyricsModel,
      onLyrics: (model, n, reason) => {
        job.progressText = `writing lyrics · ${shortModel(model ?? deps.planner.model)}${n > 1 ? ` · attempt ${n} of ${MAX_ATTEMPTS}${reason ? ` · ${reason}` : ''}` : ''}`;
      },
      ask: async (msgs, schema, { maxTokens, model = deps.planner.model }) => {
        aborted();
        const shown = job.progressText;
        await models.use(model, () => { job.progressText = 'unloading the planner'; });
        job.progressText = shown;
        aborted();
        const chars = promptChars(msgs);
        const pre = contextPreflight({ promptChars: chars, contextLength: await models.contextOf(model) });
        if (pre) throw new TurnError('context', pre);
        const reply = await deps.ask(msgs, schema, signal, maxTokens, model);
        const cut = contextPostflight({ promptTokens: reply.promptTokens, promptChars: chars, contextLength: await models.contextOf(model) });
        if (cut) throw new TurnError('context', cut);
        return reply;
      },
    });
  } finally {
    job.progressText = 'unloading the models';
    await models.releaseAll();
  }
  if (wasAborted(job)) throw new TurnError('cancelled', 'Aborted');
  if (!decision.ok) throw new TurnError('check', `no answer in ${decision.attempts} attempts: ${decision.reasons[0] ?? ''}`, decision.reasons);
  const sentRev = (user.body as UserBody | null)?.sentRev ?? thread.draft.rev;
  const r = decision.reply;
  const analyze = r.action === 'analyze' && !thread.songId ? analyzeFor(r.reference, gathered.refs, deps.plan) : null;
  const edit: EditResolved | null = r.action !== 'edit' || !gathered.edit ? null
    : !base || !decision.applied ? { reason: 'reason' in gathered.edit ? gathered.edit.reason : 'the edit was not checked against the score' }
      : { base, applied: decision.applied, attempts: decision.attempts, refusals: decision.refusals, planId: crypto.randomUUID(), createdAt: Date.now(),
        ...(decision.since && revise ? { revision: (revise.plan.revision ?? 1) + 1, since: decision.since } : {}) };
  const scrap = decision.scrapped && base && revise ? { songId: base.songId, planId: revise.plan.id } : null; // D-257
  commitReply(threadId, r, sentRev, gathered.scoreReason, gathered.refs, { analyze, edit, request: user.text, mark: mark?.edit ?? null, scrap });
  job.progressText = undefined;
  job.status = 'done';
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
