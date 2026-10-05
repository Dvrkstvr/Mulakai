/**
 * The `plan` job (F-019, F-020): one genQueue slot held from the first planner call through every
 * retry to the confirmed unload. Re-checks eligibility when its turn comes, preflights the
 * planner's context, runs planAttempts (planner ↔ yue-server apply), refuses a cut prompt, and in
 * `finally` unloads the model and waits for `/api/ps` to be empty (D-011): the slot is released
 * only when the body settles, so a repaint queued meanwhile cannot start between attempts.
 * A press may carry a pick ("this", F-032, planReferent) and may REVISE the pending plan (F-033,
 * planRevise): both are checked at the job's turn, before the planner loads; a REVISE keeps the
 * same attempts and the same load-unload hand-off per press.
 */
import crypto from 'node:crypto';
import { config } from '../../config.js';
import { queueJob } from '../jobRunner.js';
import { wasAborted, type Job } from '../jobRegistry.js';
import { songTitle } from '../queueGuards.js';
import { contextPostflight, contextPreflight } from './contextGuard.js';
import { buildOpSchema } from './opSchema.js';
import { MAX_ATTEMPTS, planAttempts, type AttemptsOutcome } from './planAttempts.js';
import { askPlanner } from './plannerClient.js';
import { planMessages, promptChars } from './plannerPrompt.js';
import { phraseBarsOf } from './phraseRequest.js';
import { dropPlan, getPlan, noteRun, setPlan } from './planStore.js';
import { referentLines, resolveReferent, staleMessage } from './planReferent.js';
import { markOps, pendingLines, reviseRefusal } from './planRevise.js';
import type { ApplyResult, ChatMessage, Op, PlanCause, PlannerReply, PlanPress, ScoreFacts, StaleReferent } from './planTypes.js';
import { withLimits } from './scoreLimits.js';
import { loadedModels, probePlanner, releasePlanner, type LoadedModel, type PlannerTarget } from './ollamaControl.js';
import { scoreStatus, type ScoreStatus } from './scoreStatus.js';
import { applyOps, type ApplyBase } from './yueScoreApply.js';

export const CHECK_FAILED = 'check failed';

/** A plan run that ended without a plan, and why: the dock picks its state from `kind`. An
 * error of any other class (planner or yue-server unreachable, unload not confirmed) is `offline`. */
export class PlanError extends Error {
  constructor(readonly kind: PlanCause, message: string, readonly reasons?: string[], readonly stale?: StaleReferent) {
    super(message);
  }
}

export interface PlanDeps {
  planner: PlannerTarget;
  status: (songId: string) => Promise<ScoreStatus>;
  probe: () => Promise<string | null>;
  ask: (messages: ChatMessage[], schema: Record<string, unknown>, signal?: AbortSignal) => Promise<PlannerReply>;
  loaded: () => Promise<LoadedModel[]>;
  apply: (base: ApplyBase, ops: Op[]) => Promise<ApplyResult>;
  release: () => Promise<unknown>;
}

export function planDeps(over: Partial<PlanDeps> = {}): PlanDeps {
  const planner = over.planner ?? { url: config.llmUrl, model: config.llmModel };
  return {
    planner,
    status: (songId) => scoreStatus(songId),
    probe: () => probePlanner(planner),
    ask: (messages, schema, signal) => askPlanner(planner, messages, schema, { timeoutMs: config.llmTimeoutMs, signal }),
    loaded: () => loadedModels(planner),
    apply: (base, ops) => applyOps(base, ops),
    release: () => releasePlanner(planner),
    ...over,
  };
}

const reasonOf = (s: ScoreStatus) => ('reason' in s.eligibility ? s.eligibility.reason : 'SCORE is not available for this song');

async function plan(job: Job, songId: string, request: string, deps: PlanDeps, signal: AbortSignal, press: PlanPress): Promise<void> {
  const status = await deps.status(songId);
  const { source, read } = status;
  if (status.eligibility.state !== 'eligible' || !source?.abc || !source.activeVersionId || !read?.facts) {
    throw new PlanError('refused', reasonOf(status));
  }
  const facts = read.facts as ScoreFacts;
  const { abc, activeVersionId } = source;
  const style = source.style ?? '';
  const base: ApplyBase = { abc, style, lyrics: source.lyrics };
  const pending = press.revise ? getPlan(songId) : undefined;
  if (press.revise) { const why = reviseRefusal(pending, press.revise, source.fingerprint); if (why) throw new PlanError('refused', why); }
  const pick = press.referent ? resolveReferent(press.referent, facts) : null;
  if (pick && !pick.ok) throw new PlanError('refused', staleMessage(pick.stale), undefined, pick.stale); // never plan on moved bars
  const referent = pick?.ok ? pick.referent : null;
  const unsupported = await deps.probe();
  if (unsupported) throw new Error(unsupported);
  const contextOf = async () => (await deps.loaded()).find((m) => m.name === deps.planner.model)?.contextLength ?? null;
  let outcome: AttemptsOutcome;
  try {
    const messages = planMessages(facts, style, request, [...referentLines(referent), ...(pending ? pendingLines(pending) : [])]);
    const pre = contextPreflight({ promptChars: promptChars(messages), contextLength: await contextOf() });
    if (pre) throw new PlanError('check', pre);
    const phraseBars = phraseBarsOf(request);
    const schema = buildOpSchema(facts, phraseBars);
    outcome = await planAttempts(facts, messages, {
      ask: async (msgs) => {
        if (wasAborted(job)) throw new PlanError('cancelled', 'Aborted');
        const reply = await deps.ask(msgs, schema, signal);
        const cut = contextPostflight({ promptTokens: reply.promptTokens, promptChars: promptChars(msgs), contextLength: await contextOf() });
        if (cut) throw new PlanError('check', cut);
        return reply;
      },
      apply: async (ops) => withLimits(await deps.apply(base, ops), { ops, sections: facts.sections }),
      onAttempt: (n, reason) => { job.progressText = `attempt ${n} of ${MAX_ATTEMPTS}${reason ? ` · ${reason}` : ''}`; },
    }, { phraseBars });
  } finally {
    job.progressText = 'unloading the planner';
    await deps.release();
  }
  if (wasAborted(job)) throw new PlanError('cancelled', 'Aborted');
  if (!outcome.ok) throw new PlanError('check', `${CHECK_FAILED}: ${outcome.reasons.join('; ')}`, outcome.reasons);
  const { applied } = outcome;
  const planId = crypto.randomUUID();
  setPlan({
    id: planId, songId, baseVersionId: activeVersionId, fingerprint: source.fingerprint, request,
    ops: outcome.ops, verdicts: applied.verdicts, abc: applied.abc, style: applied.style, lyrics: applied.lyrics ?? null,
    checks: { bars: facts.header.bars, seconds: applied.seconds, tokens: applied.tokens, chordsPresent: applied.chords_present, changed: applied.changed },
    attempts: outcome.attempts, refusals: outcome.refusals, createdAt: Date.now(),
    referent, revision: pending ? (pending.revision ?? 1) + 1 : 1, since: pending ? markOps(pending, outcome.ops) : null,
  });
  noteRun(songId, { jobId: job.id, request, reasons: [], planId, cause: null, revise: press.revise ?? null });
  job.progressText = undefined;
  job.status = 'done';
}

/** Queues a PLAN or REVISE for the song (kind `plan`); the job settles `done` with the plan in
 * planStore, or `failed` with `check failed: <reasons>` / the refusal. ABORT on the running plan
 * aborts the planner call at once (D-041); the body still unloads and confirms before the slot is
 * released, and the job stays `Aborted`. Throws QueueFullError when full. */
export function startPlan(songId: string, request: string, deps: PlanDeps = planDeps(), press: PlanPress = {}): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'queued', createdAt: Date.now(), songId };
  const call = new AbortController();
  const revise = press.revise ?? null;
  noteRun(songId, { jobId: job.id, request, reasons: [], planId: null, cause: null, revise });
  return queueJob({ kind: 'plan', songId, title: songTitle(songId), label: 'score plan' }, job, async () => {
    try {
      await plan(job, songId, request, deps, call.signal, press);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!revise) dropPlan(songId); // a failed or cancelled PLAN drops the old plan (D-028); a REVISE keeps it (D-063)
      if (wasAborted(job)) {
        noteRun(songId, { jobId: job.id, request, reasons: [], planId: null, cause: 'cancelled', revise });
        return; // stays failed with 'Aborted', as markAborted left it
      }
      const kind = err instanceof PlanError ? err.kind : 'offline';
      noteRun(songId, { jobId: job.id, request, reasons: (err instanceof PlanError && err.reasons) || [message], planId: null, cause: kind,
        revise, stale: (err instanceof PlanError && err.stale) || null });
      throw err;
    }
  }, 'running', () => call.abort());
}
