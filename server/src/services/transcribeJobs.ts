/**
 * TRANSCRIBE for a YuE2 cover (PLAN.md "YuE2 Melody Covers via SheetSage2", point 9, and
 * "Mulakai server cover decisions"): submit the source to the engine's SheetSage2 route,
 * poll, then keep the score on the job. Nothing is written to the library; the preview
 * stays on the engine and is proxied by routes/engines.ts.
 */
import crypto from 'node:crypto';
import { config } from '../config.js';
import { type Job, registerJob, run, wasAborted, MAX_POLL_STRIKES } from './jobs.js';
import { acquireGenLock, releaseGenLock } from './genLock.js';
import {
  transcribe, transcriptionStatus, fetchTranscriptionScore, cancelTranscription,
  type TranscriptionFacts, type TranscriptionState,
} from './engineTranscribeClient.js';
import type { SongEngine } from './engines/types.js';

export interface TranscriptionOutcome extends TranscriptionFacts {
  score: string;
  sourceLabel: string;
}

export interface TranscribeSource {
  data: Buffer;
  filename: string;
  label: string;
}

/** Resolves with the finished state, or undefined once aborted on our side (the engine is
 * then asked to stop too). Throws on a failed transcription. */
async function poll(job: Job, engine: SongEngine): Promise<TranscriptionState | undefined> {
  let strikes = 0;
  for (;;) {
    await new Promise((r) => setTimeout(r, config.pollIntervalMs));
    if (wasAborted(job)) {
      void cancelTranscription(engine, job.taskId);
      return undefined;
    }
    let state: TranscriptionState;
    try {
      state = await transcriptionStatus(engine, job.taskId);
      strikes = 0;
    } catch (err) {
      if (++strikes < MAX_POLL_STRIKES) continue; // same 3-strike rule as engineGenJobs.ts
      throw err;
    }
    if (wasAborted(job)) {
      void cancelTranscription(engine, job.taskId);
      return undefined;
    }
    if (state.state === 'failed') throw new Error(state.error ?? `${engine.label} transcription failed`);
    if (state.state === 'done') return state;
    job.progress = state.progress;
    job.progressStage = state.stage;
  }
}

/** Throws GenLockError synchronously if another generation holds the lock. */
export function startTranscription(engine: SongEngine, source: TranscribeSource): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'loading', createdAt: Date.now() };
  acquireGenLock({ kind: 'transcribe', jobId: job.id, title: source.label, engine: engine.id });
  registerJob(job);
  void run(job, async () => {
    job.taskId = await transcribe(engine, source.data, source.filename, job.id);
    if (wasAborted(job)) {
      void cancelTranscription(engine, job.taskId);
      return;
    }
    job.status = 'running';
    const finished = await poll(job, engine);
    if (!finished?.facts) return;
    const score = await fetchTranscriptionScore(engine, job.taskId);
    job.transcription = { ...finished.facts, score, sourceLabel: source.label };
    job.status = 'done';
  }).finally(() => releaseGenLock(job.id));
  return job;
}
