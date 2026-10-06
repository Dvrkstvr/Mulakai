/**
 * CREATE SONG (F-044, F-045): re-check at the click (the thread has no song yet, the proposal is the
 * live one, no take already running, createBlockers empty, no planner model on the GPU unless a plan
 * job holding the slot will unload it), then today's YuE2 first take with the LIVE draft, not the
 * proposal. When the take is saved, `onSaved` attaches the draft thread to the new song and appends
 * the song card. The card's message keeps the take's job id, so a reload finds it committing.
 * CREATE COVER (F-063, D-128) is the same path: a cover draft re-checks its reference and reading
 * (coverBlockers) and passes the reading's score to the take as `cover` (cot `melody`, task `cover`).
 */
import { db } from '../../db/index.js';
import { startEngineGeneration, TRUNCATED_LABEL, type EngineCover } from '../engineGenJobs.js';
import { YUE2_CAPABILITIES, yue2Engine } from '../engines/yue2.js';
import type { CreateFields, SongEngine } from '../engines/types.js';
import { QueueFullError } from '../genQueue.js';
import { getJob, type Job } from '../jobRegistry.js';
import { draftFields } from './draftFields.js';
import { gpuGuard, gpuGuardDeps, type GpuGuardDeps } from './gpuGuard.js';
import { appendMessage, updateMessage } from './messageStore.js';
import { proposalById, proposalLife } from './proposalStore.js';
import { createBlockers } from './recipeRules.js';
import { isRead } from './reading.js';
import { coverBlockers } from './referenceRecipe.js';
import { getReference } from './referenceStore.js';
import { baseVersions } from './songStateSource.js';
import { attach, threadById } from './threadStore.js';
import type { CardBody, ChatThread } from './chatTypes.js';

/** The engine, the take's start, and gpuGuard's checks (no planner on the GPU unless a `plan` job holds the slot). */
export interface CreateDeps extends GpuGuardDeps {
  engine: SongEngine;
  start: typeof startEngineGeneration;
}

export function createDeps(over: Partial<CreateDeps> = {}): CreateDeps {
  return { engine: yue2Engine, start: startEngineGeneration, ...gpuGuardDeps(), ...over };
}

/** A cover draft's score and source, or why CREATE COVER cannot run; `{}` for a draft that is not a cover. */
function coverOf(thread: ChatThread): { cover?: EngineCover; reason?: string } {
  const use = thread.draft.reference;
  if (use?.use !== 'cover') return {};
  const ref = getReference(use.referenceId);
  const blocked = coverBlockers(thread.draft, ref && ref.threadId === thread.id ? ref : null);
  if (blocked.length || !ref?.reading || !isRead(ref.reading.score)) return { reason: blocked.join('; ') || 'the reference has not been read: press READ first' };
  return { cover: { abc: ref.reading.score.abc, source: ref.name } };
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
  const label = v1?.label ?? '';
  const body: CardBody = { seconds: song?.duration ?? null, label, number: 1, truncated: label === TRUNCATED_LABEL };
  appendMessage(threadId, {
    role: 'assistant', kind: 'song', text: 'Saved as v1 in your Library. Press play below. To change it, use SCORE in the Editor.',
    body, versionId: v1?.id ?? null, jobId,
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
  const { cover, reason } = coverOf(thread);
  if (reason) return { reason };
  const refused = await gpuGuard(deps);
  if (refused) return { reason: refused };
  const { title, fields } = draftFields(thread.draft.fields);
  let jobId = '';
  let job: Job;
  try {
    job = deps.start(deps.engine, withLanguage(fields, thread.draft.fields.language), title, undefined, cover,
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
