/**
 * Global single-flight lock: only one ACE-Step generation job (song
 * generation, repaint, regenerate, retake, add layer, split, remaster) may
 * run at a time. ACE-Step's own queue is effectively single-worker by default
 * (docs/ace-step-1.5/API.md#Queue Configuration), so letting the client fire
 * several at once just queues them invisibly — this makes that limit explicit
 * and lets the UI show one clear "busy" state instead. An extra engine's song
 * generation holds it too, under `generate`: the 16 GB card fits only one model
 * in VRAM at a time (PLAN.md "Multiple Song-Creation Engines", design point 10).
 */
import type { EngineId } from './engines/types.js';

/** `transcribe` is SheetSage2 reading a cover source's melody (transcribeJobs.ts), and
 * `lyrics` is lyrics-server reading its words (lyricsJobs.ts): small, but neither may run
 * next to an ACE-Step job on a 16 GB card. */
export type GenKind = 'generate' | 'repaint' | 'regenerate' | 'retake' | 'addLayer' | 'split' | 'remaster' | 'transcribe' | 'lyrics';

/** The three ACE-Step tasks that create a whole new song — all held under the single
 * `generate` kind, so this is what tells them apart. Mirrors `songs.gen_task`. */
export type GenTask = 'text2music' | 'cover' | 'complete';

export interface GenLockInfo {
  kind: GenKind;
  jobId: string;
  songId?: string;
  title?: string;
  caption?: string;
  /** Only set for `generate` — lets a client rehydrating mid-generation (or retrying a
   * failed one after a refresh) reopen Create on the tab that started it. */
  task?: GenTask;
  /** Set for a `generate` running on an extra engine (absent = ACE-Step), and for a
   * `transcribe`. For a `generate` it lets a rehydrated GeneratingCard and a retry reopen
   * with the right engine. */
  engine?: EngineId;
  startedAt: number;
}

export class GenLockError extends Error {
  constructor() {
    super('a generation is already in progress');
  }
}

let active: GenLockInfo | null = null;

/** Throws GenLockError if another generation is already running. */
export function acquireGenLock(info: Omit<GenLockInfo, 'startedAt'>): void {
  if (active) throw new GenLockError();
  active = { ...info, startedAt: Date.now() };
}

/** No-op if `jobId` isn't the current lock holder (e.g. already released, or never acquired). */
export function releaseGenLock(jobId: string): void {
  if (active?.jobId === jobId) active = null;
}

export function getGenLock(): GenLockInfo | null {
  return active;
}
