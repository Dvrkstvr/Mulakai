/**
 * One ✦ HELP call (PLAN.md "Editor Redesign", the field helper): a `plan`-kind job in the GPU queue, label `help`, so it
 * never shares the card with a render. At its turn: probe the planner, ask one model (the planner's, or for lyrics the
 * lyrics model of their language, gemma4 for German) through the chat's model session, keep the usable suggestions,
 * and in `finally` unload every model it touched and read `/api/ps` empty before the slot is released (D-011).
 * Nothing is written anywhere: the suggestions ride the job until the client reads them.
 */
import crypto from 'node:crypto';
import { config } from '../../config.js';
import { queueJob } from '../jobRunner.js';
import type { Job } from '../jobRegistry.js';
import { songTitle } from '../queueGuards.js';
import { askPlanner } from '../score/plannerClient.js';
import { loadedModels, probePlanner, releaseModels, type CutCall, type LoadedModel, type PlannerTarget } from '../score/ollamaControl.js';
import type { ChatMessage, PlannerReply } from '../score/planTypes.js';
import { modelSession } from '../chat/turnModels.js';
import { lyricsModelFor } from '../chat/lyricsModels.js';
import { detectLanguage } from '../chat/lyricLanguage.js';
import { ASSIST_SCHEMA, assistMessages, keepSuggestions, type AssistRequest } from './assistPrompt.js';

/** Room for three rewrites of a section with their reasons. */
export const ASSIST_MAX_TOKENS = 1500;

export interface AssistDeps {
  planner: PlannerTarget;
  probe: (model: string) => Promise<string | null>;
  ask: (messages: ChatMessage[], schema: Record<string, unknown>, signal: AbortSignal, maxTokens: number, model: string) => Promise<PlannerReply>;
  loaded: () => Promise<LoadedModel[]>;
  release: (models: string[], cut?: CutCall) => Promise<unknown>;
  lyricsModel: (language: string) => string;
  detect: (text: string) => Promise<string | null>;
}

export function assistDeps(over: Partial<AssistDeps> = {}): AssistDeps {
  const planner = over.planner ?? { url: config.llmUrl, model: config.llmModel };
  return {
    planner,
    probe: (model) => probePlanner({ url: planner.url, model }),
    ask: (messages, schema, signal, maxTokens, model) =>
      askPlanner({ url: planner.url, model }, messages, schema, { timeoutMs: config.llmTimeoutMs, signal, maxTokens }),
    loaded: () => loadedModels(planner),
    release: (models, cut) => releaseModels(planner.url, models, { cut }),
    lyricsModel: (language) => lyricsModelFor(language, process.env, planner.model),
    detect: detectLanguage,
    ...over,
  };
}

/** The body of one help job: suggestions on `job.assist`, or a thrown reason the job fails with. */
export async function runAssist(job: Job, req: AssistRequest, deps: AssistDeps, signal: AbortSignal): Promise<void> {
  const why = await deps.probe(deps.planner.model);
  if (why) throw new Error(why);
  const language = req.kind === 'lyrics' ? req.language ?? await deps.detect(req.current).catch(() => null) : null;
  const model = req.kind === 'lyrics' && language ? deps.lyricsModel(language) : deps.planner.model;
  const models = modelSession({ probe: deps.probe, loaded: deps.loaded, release: deps.release }, deps.planner.model);
  try {
    await models.use(model);
    const ask = { ...req, language };
    const reply = await models.call(model, () => deps.ask(assistMessages(ask), ASSIST_SCHEMA, signal, ASSIST_MAX_TOKENS, model));
    let parsed: unknown = null;
    try { parsed = JSON.parse(reply.content); } catch { /* kept empty: no usable suggestion */ }
    const suggestions = keepSuggestions(ask, parsed);
    if (suggestions.length === 0) throw new Error('no usable suggestion came back · ask again, or say what you want');
    job.assist = { suggestions };
    job.status = 'done';
  } finally {
    await models.releaseAll();
  }
}

/** Queue a help call; the client polls `/api/generate/status/:jobId` for `assist`. Throws QueueFullError. */
export function startAssist(req: AssistRequest, deps: AssistDeps = assistDeps()): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'queued', songId: req.songId, createdAt: Date.now() };
  const call = new AbortController();
  const info = { kind: 'plan' as const, label: 'help', title: songTitle(req.songId), songId: req.songId };
  return queueJob(info, job, () => runAssist(job, req, deps, call.signal), 'running', () => call.abort());
}
