/**
 * Global single-flight lock: only one ACE-Step generation job (song
 * generation, repaint, regenerate, retake, add layer, split, remaster) may
 * run at a time. ACE-Step's own queue is effectively single-worker by default
 * (docs/ace-step-1.5/API.md#Queue Configuration), so letting the client fire
 * several at once just queues them invisibly — this makes that limit explicit
 * and lets the UI show one clear "busy" state instead.
 */

export type GenKind = 'generate' | 'repaint' | 'regenerate' | 'retake' | 'addLayer' | 'split' | 'remaster';

export interface GenLockInfo {
  kind: GenKind;
  jobId: string;
  songId?: string;
  title?: string;
  caption?: string;
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
