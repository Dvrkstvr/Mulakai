/**
 * CREATE SONG (F-044, F-045): re-check at the click (the thread has no song yet, the proposal is the
 * live one, no take already running, createBlockers empty, no planner model on the GPU unless a plan
 * job holding the slot will unload it), then today's YuE2 first take with the LIVE draft, not the
 * proposal. When the take is saved, `onSaved` attaches the draft thread to the new song and appends
 * the song card. The card's message keeps the take's job id, so a reload finds it committing.
 */
import { config } from '../../config.js';
import { db } from '../../db/index.js';
import { startEngineGeneration } from '../engineGenJobs.js';
import { YUE2_CAPABILITIES, yue2Engine } from '../engines/yue2.js';
import type { CreateFields, SongEngine } from '../engines/types.js';
import { getRunning, QueueFullError } from '../genQueue.js';
import { getJob, type Job } from '../jobRegistry.js';
import { loadedModels, type LoadedModel } from '../score/ollamaControl.js';
import { plannerLoaded } from '../score/scoreLimits.js';
import { draftFields } from './draftFields.js';
import { appendMessage, updateMessage } from './messageStore.js';
import { proposalById, proposalLife } from './proposalStore.js';
import { createBlockers } from './recipeRules.js';
import { baseVersions } from './songStateSource.js';
import { attach, threadById } from './threadStore.js';

export interface CreateDeps {
  engine: SongEngine;
  start: typeof startEngineGeneration;
  /** The planner's `/api/ps`. */
  loaded: () => Promise<LoadedModel[]>;
  plannerConfigured: boolean;
  /** A `plan` job holds the slot: it unloads before the take can start (D-011). */
  planRunning: () => boolean;
}

export function createDeps(over: Partial<CreateDeps> = {}): CreateDeps {
  return {
    engine: yue2Engine, start: startEngineGeneration, plannerConfigured: Boolean(config.llmUrl),
    loaded: () => loadedModels({ url: config.llmUrl, model: config.llmModel }),
    planRunning: () => getRunning()?.kind === 'plan',
    ...over,
  };
}

const LANGUAGE_WORD: Record<string, string> = { en: 'English', de: 'German', es: 'Spanish', fr: 'French', it: 'Italian', pt: 'Portuguese' };

/** YuE2 hears a language only from its style, and buildYue2Request names en / zh only (D-112): put
 * the language word first when the style does not already say it. Pure. */
export function withLanguage(fields: CreateFields, language: string | undefined): CreateFields {
  const word = language ? LANGUAGE_WORD[language] : undefined;
  const listed = YUE2_CAPABILITIES.languages === 'any' || YUE2_CAPABILITIES.languages.includes(language ?? '');
  const prompt = fields.prompt ?? '';
  if (!word || listed || prompt.toLowerCase().includes(word.toLowerCase())) return fields;
  return { ...fields, prompt: prompt ? `${word}, ${prompt}` : word };
}

const takes = new Map<string, string>(); // threadId -> the running take's job id
const running = (jobId: string | undefined) => {
  const s = jobId ? getJob(jobId)?.status : undefined;
  return s === 'queued' || s === 'loading' || s === 'running';
};
export const takeRunning = (threadId: string): boolean => running(takes.get(threadId));

/** The draft thread becomes the song's thread; the song card follows the recipe card. */
function landed(threadId: string, songId: string, jobId: string): void {
  attach(threadId, songId);
  const v1 = baseVersions(songId)[0];
  const song = db.prepare(`SELECT duration FROM songs WHERE id = ?`).get(songId) as { duration: number | null } | undefined;
  appendMessage(threadId, {
    role: 'assistant', kind: 'song', text: 'Saved as v1 in your Library. Press play below. To change it, use SCORE in the Editor.',
    body: { seconds: song?.duration ?? null, label: v1?.label ?? '', number: 1 }, versionId: v1?.id ?? null, jobId,
  });
}

export async function createFromDraft(threadId: string, proposalId: string, deps: CreateDeps = createDeps()): Promise<{ job: Job } | { reason: string }> {
  const thread = threadById(threadId);
  if (!thread) return { reason: 'this chat no longer exists' };
  if (thread.songId) return { reason: 'this chat already made its song' };
  const life = proposalById(proposalId)?.threadId === threadId ? proposalLife(proposalId) : null;
  if (!life) return { reason: 'this proposal expired: ask again' };
  if (life === 'superseded') return { reason: 'a newer proposal replaced this one' };
  if (takeRunning(threadId)) return { reason: 'CREATE SONG is already running for this chat' };
  const blockers = createBlockers(thread.draft.fields, { yueConfigured: Boolean(deps.engine.url) });
  if (blockers.length) return { reason: blockers.join('; ') };
  if (deps.plannerConfigured && !deps.planRunning()) {
    const models = await deps.loaded().catch(() => [] as LoadedModel[]);
    if (models.length) return { reason: plannerLoaded(models.map((m) => m.name)) };
  }
  const { title, fields } = draftFields(thread.draft.fields);
  let jobId = '';
  let job: Job;
  try {
    job = deps.start(deps.engine, withLanguage(fields, thread.draft.fields.language), title, undefined, undefined,
      (songId) => landed(threadId, songId, jobId));
  } catch (err) {
    if (err instanceof QueueFullError) return { reason: err.message };
    throw err;
  }
  jobId = job.id;
  takes.set(threadId, job.id);
  updateMessage(proposalById(proposalId)!.messageId, { jobId: job.id });
  return { job };
}
