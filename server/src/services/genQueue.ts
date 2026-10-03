/**
 * The GPU job queue (PLAN.md "UI Redesign", S4): one running slot plus a FIFO of queued
 * entries, in memory. Only one ACE-Step job (song generation, repaint, regenerate, retake,
 * add layer, split, remaster, audio analysis) may run at a time: ACE-Step's own queue is
 * effectively single-worker (docs/ace-step-1.5/API.md#Queue Configuration), and the 16 GB
 * card fits only one model in VRAM at a time, so an extra engine's generation, SheetSage2's
 * TRANSCRIBE and lyrics-server's reads wait here too. A second submission waits its turn
 * instead of being refused; a server restart loses the queue, like the job registry.
 */
import type { EngineId } from './engines/types.js';

/** `transcribe` is SheetSage2 reading a cover source's melody (transcribeJobs.ts), `lyrics`
 * is lyrics-server reading its words (lyricsJobs.ts), and `timings` is lyrics-server reading
 * a version's words for the Editor (timingsJobs.ts). `analyze` is ACE-Step describing a
 * source (analyzeJobs.ts), which loads a DiT and the LM. */
export type GenKind =
  | 'generate' | 'repaint' | 'regenerate' | 'retake' | 'addLayer' | 'split' | 'remaster'
  | 'transcribe' | 'lyrics' | 'timings' | 'analyze';

/** The three ACE-Step tasks that create a whole new song — all held under the single
 * `generate` kind, so this is what tells them apart. Mirrors `songs.gen_task`. */
export type GenTask = 'text2music' | 'cover' | 'complete';

export interface QueueInfo {
  kind: GenKind;
  jobId: string;
  songId?: string;
  title?: string;
  caption?: string;
  /** Only set for `generate` — lets a client rehydrating mid-generation (or retrying a
   * failed one after a refresh) reopen Create on the tab that started it. */
  task?: GenTask;
  /** Set for a `generate` running on an extra engine (absent = ACE-Step), and for a
   * `transcribe`. */
  engine?: EngineId;
  /** The layer an edit works on, by name, for Activity's UP NEXT row. */
  layer?: string;
  /** What the job does, in a few words ("repaint 1:32–2:07"), for the same row. */
  label?: string;
}

export interface RunningInfo extends QueueInfo {
  startedAt: number;
}

export interface QueuedInfo extends QueueInfo {
  queuedAt: number;
  /** 1 = next to run. */
  position: number;
}

/** At most this many jobs wait behind the running one. */
export const QUEUE_LIMIT = 10;

export class QueueFullError extends Error {
  constructor() {
    super(`the queue is full (${QUEUE_LIMIT} jobs waiting) — cancel one or wait for one to finish`);
  }
}

interface Entry {
  info: QueueInfo;
  queuedAt: number;
  run: () => Promise<unknown> | void;
  /** Settles the job's own record when it leaves the queue without running. */
  onCancel: (reason: string) => void;
}

let running: RunningInfo | null = null;
const queue: Entry[] = [];

function start(entry: Entry): void {
  running = { ...entry.info, startedAt: Date.now() };
  const { jobId } = entry.info;
  let done: Promise<unknown>;
  try {
    done = Promise.resolve(entry.run());
  } catch (err) {
    done = Promise.reject(err);
  }
  void done.catch(() => {}).finally(() => releaseSlot(jobId));
}

/**
 * Runs `run` now if the slot is free, else queues it. Returns the job's queue position:
 * 0 = started right away. `run`'s settling frees the slot for the next entry. Throws
 * QueueFullError, before anything is queued, when QUEUE_LIMIT jobs already wait.
 */
export function enqueue(info: QueueInfo, run: Entry['run'], onCancel: Entry['onCancel'] = () => {}): number {
  const entry: Entry = { info, queuedAt: Date.now(), run, onCancel };
  if (!running && queue.length === 0) {
    start(entry);
    return 0;
  }
  if (queue.length >= QUEUE_LIMIT) throw new QueueFullError();
  queue.push(entry);
  return queue.length;
}

/** Frees the slot if `jobId` holds it, and starts the next queued job. A no-op otherwise
 * (already released by an abort, or never running). */
export function releaseSlot(jobId: string): void {
  if (running?.jobId !== jobId) return;
  running = null;
  const next = queue.shift();
  if (next) start(next);
}

/** Removes queued jobs matching `match`, settling each through its onCancel. */
function cancelWhere(match: (info: QueueInfo) => boolean, reason: string): string[] {
  const gone = queue.filter((e) => match(e.info));
  for (const entry of gone) {
    queue.splice(queue.indexOf(entry), 1);
    entry.onCancel(reason);
  }
  return gone.map((e) => e.info.jobId);
}

/** Takes a queued job out of the line. False if it isn't queued (running, settled, unknown). */
export function cancelQueued(jobId: string, reason = 'cancelled'): boolean {
  return cancelWhere((info) => info.jobId === jobId, reason).length > 0;
}

/** Trashing a song cancels every job still waiting to work on it. */
export function cancelQueuedForSong(songId: string, reason: string): string[] {
  return cancelWhere((info) => info.songId === songId, reason);
}

export function getRunning(): RunningInfo | null {
  return running;
}

export function getQueued(): QueuedInfo[] {
  return queue.map((e, i) => ({ ...e.info, queuedAt: e.queuedAt, position: i + 1 }));
}

/** 1-based place in line, or undefined when the job isn't queued. */
export function queuePosition(jobId: string): number | undefined {
  const i = queue.findIndex((e) => e.info.jobId === jobId);
  return i < 0 ? undefined : i + 1;
}

export function isQueued(jobId: string): boolean {
  return queuePosition(jobId) !== undefined;
}

/** Test hook: empty the line and the slot without settling anything. */
export function resetQueue(): void {
  running = null;
  queue.length = 0;
}
