/**
 * The version analysis (F-052, D-171, D-172, D-179, docs/decisions/0009): one `transcribe`-kind job, label
 * `chat analysis`, holds one queue slot through WORDS > SCORE > SECTIONS (analysisSteps). One waiting
 * job per song: a second save while it waits starts nothing, and the job reads the song's playable version as
 * it is when it starts (a newer take wins). At its turn: already read → done, nothing read; `gpuGuard` (no
 * planner on the GPU); the plan; the steps with a cancel check between them; the analysis saved on the version
 * row, lyrics-server's reading in `word_timings`. Only an unreadable audio file or a guard refusal fails the job,
 * and that failure is stored too, so FAILED + RETRY survive a reload. A cancelled analysis saves nothing.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import { db } from '../../db/index.js';
import { measureScore, transcriptionGrid } from '../engineTranscribeClient.js';
import { yue2Engine } from '../engines/yue2.js';
import type { SongEngine } from '../engines/types.js';
import { queuePosition } from '../genQueue.js';
import { queueJob } from '../jobRunner.js';
import { wasAborted, type Job } from '../jobRegistry.js';
import { transcribeLyrics } from '../lyricsClient.js';
import { scoreBars } from '../score/yueScoreBars.js';
import { readScore } from '../score/yueScoreRead.js';
import { runTranscription } from '../transcribeJobs.js';
import { scoreSidecarName } from '../versionFiles.js';
import { analysisPlan, analysisSources } from './analysisPlan.js';
import { analyzeSteps, type AnalysisStepDeps } from './analysisSteps.js';
import { playableVersion, readVersionAnalysis, wordTimings, writeAnalysis } from './analysisStore.js';
import { ANALYSIS_V, isComplete, type LiveAnalysisJob } from './analysisTypes.js';
import { gpuGuard } from './gpuGuard.js';
import { readGrid, writeGrid } from './gridCache.js';
import type { Services } from './readingPlan.js';

export const ANALYSIS_LABEL = 'chat analysis';

export interface AnalysisDeps {
  engine: SongEngine;
  /** Overrides of the step clients built on `engine` (tests stub lyrics-server). */
  steps: Partial<AnalysisStepDeps>;
  services: () => Promise<Services>;
  guard: () => Promise<string | null>;
  now: () => Date;
}

export function analysisDeps(over: Partial<AnalysisDeps> = {}): AnalysisDeps {
  const engine = over.engine ?? yue2Engine;
  return {
    engine, steps: {},
    services: async () => ({ lyrics: Boolean(config.lyricsUrl), yue: Boolean(engine.url), acestep: false }),
    guard: () => gpuGuard(),
    now: () => new Date(),
    ...over,
  };
}

function stepDeps(job: Job, title: string, deps: AnalysisDeps): AnalysisStepDeps {
  const e = deps.engine;
  return {
    lyrics: (audio, filename, signal) => transcribeLyrics(audio, filename, '', signal),
    transcribe: (data, filename, onProgress) => runTranscription(job, e, { data, filename, label: title }, { chords: true }, onProgress),
    readScore: (abc, lyrics) => readScore(abc, lyrics, e),
    measure: (abc) => measureScore(e, abc),
    grid: (id) => transcriptionGrid(e, id),
    bars: (abc, grid, source) => scoreBars(e, abc, grid, source),
    readGrid, writeGrid,
    ...deps.steps,
  };
}

const aborted = (job: Job) => new Error(job.error ?? 'Aborted');
const live = (job: Job | undefined): job is Job => Boolean(job && ['queued', 'loading', 'running'].includes(job.status));

async function readSidecar(versionId: string): Promise<string | null> {
  return fs.promises.readFile(path.join(config.audioDir, scoreSidecarName(versionId)), 'utf8').catch(() => null);
}

function lyricsOf(paramsJson: string): string | null {
  try {
    const lyrics = (JSON.parse(paramsJson) as { request?: { lyrics?: unknown } } | null)?.request?.lyrics;
    return typeof lyrics === 'string' ? lyrics : null;
  } catch {
    return null;
  }
}

async function analyze(job: Job, songId: string, title: string, deps: AnalysisDeps, signal: AbortSignal): Promise<void> {
  const target = playableVersion(songId);
  if (!target) {
    if (!db.prepare(`SELECT 1 FROM songs WHERE id = ? AND trashed_at IS NULL`).get(songId)) throw new Error('this song no longer exists');
    return; // no take to read yet
  }
  targets.set(job.id, target.id);
  const stored = readVersionAnalysis(target.id);
  if (isComplete(stored)) return; // already read (a failed or gapped reading is read again: RETRY, B1)
  const fail = (reason: string) => {
    writeAnalysis({ analysis_v: ANALYSIS_V, versionId: target.id, failed: reason, at: deps.now().toISOString() });
    return new Error(reason);
  };
  const refused = await deps.guard();
  if (refused) throw fail(refused);
  const row = db.prepare(`SELECT audio_file, params_json FROM versions WHERE id = ?`).get(target.id) as { audio_file: string; params_json: string } | undefined;
  if (!row) throw new Error('this version was deleted before it was read');
  let audio: Buffer;
  try {
    audio = await fs.promises.readFile(path.join(config.audioDir, row.audio_file));
  } catch {
    throw fail('the audio file is missing');
  }
  const steps = stepDeps(job, title, deps);
  const sidecar = await readSidecar(target.id);
  const abc = sidecar?.trim() ? sidecar : null;
  const storedWords = wordTimings(target.id);
  const facts = { ownScore: abc !== null, wordTimings: storedWords !== null, cachedGrid: (await steps.readGrid(target.id)) !== null };
  const plan = analysisPlan(facts, await deps.services());
  const parts = await analyzeSteps({
    versionId: target.id, audio, filename: path.basename(row.audio_file), own: abc ? { abc, lyrics: lyricsOf(row.params_json) } : null,
    storedWords, plan, signal, progress: (text) => { job.progressText = text; },
  }, steps, () => { if (wasAborted(job)) throw aborted(job); });
  const saved = writeAnalysis({
    analysis_v: ANALYSIS_V, versionId: target.id, readAt: deps.now().toISOString(), plan: analysisSources(plan),
    words: parts.words, score: parts.score, bars: parts.bars,
  });
  if (!saved) throw new Error('this version was deleted while it was read');
  if (parts.timings) db.prepare(`UPDATE versions SET word_timings = ? WHERE id = ?`).run(JSON.stringify(parts.timings), target.id);
}

/** Song id → its waiting analysis, and the one reading now; job id → the take it reads. */
const waiting = new Map<string, Job>();
const reading = new Map<string, Job>();
const targets = new Map<string, string>();

/** A waiting analysis for the song (a new save then starts nothing). */
export const analysisWaiting = (songId: string): boolean => waiting.get(songId)?.status === 'queued';

/** An analysis will read this take: one waits (it reads the newest take), or one is reading it now. */
export function analysisPending(songId: string, versionId: string): boolean {
  const r = reading.get(songId);
  return analysisWaiting(songId) || (live(r) && targets.get(r.id) === versionId);
}

/** The song's analysis as the queue sees it, for the player's view: the waiting one first (it reads the newest take). */
export function liveAnalysis(songId: string): LiveAnalysisJob | null {
  const w = waiting.get(songId);
  if (w?.status === 'queued') return { jobId: w.id, status: 'queued', ahead: queuePosition(w.id) ?? 0, progressText: null };
  const r = reading.get(songId);
  return live(r) ? { jobId: r.id, status: 'running', ahead: 0, progressText: r.progressText ?? null } : null;
}

/** Queues the song's analysis, or returns the one already waiting. Throws QueueFullError when the queue is full. */
export function startAnalysis(songId: string, deps: AnalysisDeps = analysisDeps()): Job {
  const queued = waiting.get(songId);
  if (queued?.status === 'queued') return queued;
  const title = (db.prepare(`SELECT title FROM songs WHERE id = ?`).get(songId) as { title: string } | undefined)?.title ?? 'song';
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'queued', createdAt: Date.now() };
  const call = new AbortController();
  const body = async () => {
    if (waiting.get(songId) === job) waiting.delete(songId);
    reading.set(songId, job);
    try {
      await analyze(job, songId, title, deps, call.signal);
      if (!wasAborted(job)) job.status = 'done';
    } finally {
      job.progressText = undefined;
      targets.delete(job.id);
      if (reading.get(songId) === job) reading.delete(songId);
    }
  };
  waiting.set(songId, job); // before queueJob: an idle queue starts the body at once
  try {
    return queueJob({ kind: 'transcribe', label: ANALYSIS_LABEL, songId, title, engine: deps.engine.id }, job, body, 'running', () => call.abort());
  } catch (err) {
    if (waiting.get(songId) === job) waiting.delete(songId);
    throw err;
  }
}
