/**
 * READ (F-061, D-126, docs/decisions/0008): one `transcribe`-kind job, label `chat reading`, holds one
 * queue slot through WORDS > SCORE > CAPTION. At its turn: the reference read again, `gpuGuard` (no
 * planner on the GPU), the plan, a 360 s temp trim of a longer file (D-138), the three steps with a
 * cancel check between them; `finally`: temps removed and the planner confirmed off the GPU (R-028),
 * then the `Reading` saved on the row, snapshotted into the reading card, and `onRead` (D-129's
 * follow-up turn). The job fails only when the file cannot be read at all, or the guard refuses.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import { analyzeAudio, health, listModels } from '../acestep.js';
import { measureScore } from '../engineTranscribeClient.js';
import { yue2Engine } from '../engines/yue2.js';
import type { SongEngine } from '../engines/types.js';
import { cancelQueued } from '../genQueue.js';
import { queueJob } from '../jobRunner.js';
import { abortJob, wasAborted, type Job } from '../jobRegistry.js';
import { transcribeLyrics } from '../lyricsClient.js';
import { loadedModels, releasePlanner } from '../score/ollamaControl.js';
import { readScore } from '../score/yueScoreRead.js';
import { runTranscription } from '../transcribeJobs.js';
import { trimAudio } from '../transcode.js';
import { gpuGuard } from './gpuGuard.js';
import { messageById, updateMessage } from './messageStore.js';
import { READING_V, type Reading } from './reading.js';
import { planSources, readingPlan, type Part, type Services } from './readingPlan.js';
import { runStep, stepText, type StepDeps } from './readingSteps.js';
import { getReference, setReading, type Reference } from './referenceStore.js';
import { readSpan } from './referenceRules.js';
import type { ReadingBody } from './chatTypes.js';

export interface ReadingOptions {
  threadId: string;
  /** The reading card (its `body.reading` gets the snapshot once saved). */
  cardId?: string;
  /** After the save: the follow-up turn (D-129); RE-ANALYZE passes none. */
  onRead?: (reading: Reading, reference: Reference) => void;
}

export interface ReadingDeps {
  engine: SongEngine;
  /** Overrides of the step clients built on `engine` (tests stub lyrics-server and ACE-Step). */
  steps: Partial<StepDeps>;
  services: () => Promise<Services>;
  guard: () => Promise<string | null>;
  trim: (src: string, dst: string, seconds: number) => Promise<void>;
  /** Confirms no planner model is left on the GPU before the slot is released. */
  settle: () => Promise<unknown>;
  now: () => Date;
}

/** ANALYZE AUDIO as Guided Create runs it (D-135): a cold ACE-Step loads its default model first. */
async function analyzeLoading(file: { data: Buffer; filename: string }) {
  try {
    return await analyzeAudio(file);
  } catch (err) {
    if (!/not initiali[sz]ed/i.test(err instanceof Error ? err.message : String(err))) throw err;
    return analyzeAudio(file, (await listModels()).defaultModel ?? undefined);
  }
}

export function readingDeps(over: Partial<ReadingDeps> = {}): ReadingDeps {
  const planner = { url: config.llmUrl, model: config.llmModel };
  const engine = over.engine ?? yue2Engine;
  return {
    engine, steps: {},
    services: async () => ({ lyrics: Boolean(config.lyricsUrl), yue: Boolean(engine.url), acestep: await health() }),
    guard: () => gpuGuard(),
    trim: trimAudio,
    settle: async () => (planner.url && (await loadedModels(planner).catch(() => [])).length ? releasePlanner(planner) : undefined),
    now: () => new Date(),
    ...over,
  };
}

function stepDeps(job: Job, name: string, deps: ReadingDeps): StepDeps {
  return {
    lyrics: (audio, filename, signal) => transcribeLyrics(audio, filename, '', signal),
    transcribe: (data, filename, onProgress) => runTranscription(job, deps.engine, { data, filename, label: name }, { chords: true }, onProgress),
    readScore: (abc, lyrics) => readScore(abc, lyrics, deps.engine),
    measure: (abc) => measureScore(deps.engine, abc),
    analyze: analyzeLoading,
    ...deps.steps,
  };
}

const aborted = (job: Job) => new Error(job.error ?? 'Aborted');

async function read(job: Job, referenceId: string, deps: ReadingDeps, signal: AbortSignal, temps: string[]): Promise<{ ref: Reference; reading: Reading }> {
  const ref = getReference(referenceId);
  if (!ref) throw new Error('this reference no longer exists');
  const refused = await deps.guard();
  if (refused) throw new Error(refused);
  const plan = readingPlan(ref.own, await deps.services());
  const span = readSpan(ref.seconds);
  let file = path.join(config.audioDir, ref.file);
  if (span.cut) {
    fs.mkdirSync(path.join(config.dataDir, 'tmp'), { recursive: true });
    const temp = path.join(config.dataDir, 'tmp', `reading-${job.id}.flac`);
    temps.push(temp);
    await deps.trim(file, temp, span.to).catch((err: Error) => { throw new Error(`${ref.name} could not be read: ${err.message}`); });
    file = temp;
  }
  let audio: Buffer;
  try {
    audio = await fs.promises.readFile(file);
  } catch {
    throw new Error(`${ref.name} could not be read: the file is gone`);
  }
  const steps = stepDeps(job, ref.name, deps);
  const parts: Partial<Pick<Reading, Part>> = {};
  for (const part of ['words', 'score', 'caption'] as const) {
    if (wasAborted(job)) throw aborted(job);
    const progress = (note?: string) => { job.progressText = stepText(part, note); };
    (parts as Record<Part, unknown>)[part] = await runStep(part, { audio, filename: path.basename(file), own: ref.own, step: plan[part], signal, progress }, steps);
  }
  if (wasAborted(job)) throw aborted(job);
  return {
    ref,
    reading: {
      reading_v: READING_V, readAt: deps.now().toISOString(), seconds: ref.seconds, readTo: span.to, cut: span.cut,
      plan: planSources(plan), words: parts.words!, score: parts.score!, caption: parts.caption!,
    },
  };
}

/** Live readings: job id -> its reference and thread (the cancel route's lookup). */
const readings = new Map<string, { referenceId: string; threadId: string }>();
export const readingOf = (jobId: string) => readings.get(jobId);

/** Queues the reading of `referenceId`. Throws QueueFullError when the queue is full. */
export function startReading(referenceId: string, opts: ReadingOptions, deps: ReadingDeps = readingDeps()): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'queued', createdAt: Date.now() };
  const call = new AbortController();
  const name = getReference(referenceId)?.name ?? 'reference';
  readings.set(job.id, { referenceId, threadId: opts.threadId });
  const body = async () => {
    const temps: string[] = [];
    let out: Awaited<ReturnType<typeof read>>;
    let unsettled: unknown = null;
    try {
      out = await read(job, referenceId, deps, call.signal, temps);
    } finally {
      try {
        await Promise.all(temps.map((t) => fs.promises.rm(t, { force: true })));
        job.progressText = undefined;
        await deps.settle().catch((err: unknown) => { unsettled = err; });
      } finally {
        readings.delete(job.id); // never a thread left BUSY by a reading that ended
      }
    }
    if (wasAborted(job)) throw aborted(job); // a CANCEL during the settle wins: no save, no follow-up
    if (!setReading(referenceId, out.reading)) throw new Error('this reference no longer exists');
    const card = opts.cardId ? messageById(opts.cardId) : null;
    if (card?.kind === 'reading') updateMessage(card.id, { body: { ...(card.body as ReadingBody), reading: out.reading } });
    if (unsettled) throw unsettled; // the reading is kept; no follow-up turn while the planner may be on the GPU
    job.status = 'done';
    try {
      opts.onRead?.(out.reading, out.ref);
    } catch { /* the reading is saved; a follow-up that cannot queue is the caller's to report */ }
  };
  try {
    return queueJob({ kind: 'transcribe', label: 'chat reading', title: name, engine: deps.engine.id }, job, body, 'running', () => call.abort());
  } catch (err) {
    readings.delete(job.id);
    throw err;
  }
}

/** CANCEL: a queued reading leaves the line; a running one stops at its next step (a running
 * transcription is asked to stop and drained first). False when the job is not a live reading. */
export function cancelReading(jobId: string): boolean {
  if (!readings.has(jobId)) return false;
  if (cancelQueued(jobId)) {
    readings.delete(jobId);
    return true;
  }
  return abortJob(jobId);
}
