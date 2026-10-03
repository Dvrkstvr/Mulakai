/**
 * TRANSCRIBE for a YuE2 cover (PLAN.md "YuE2 Melody Covers via SheetSage2", point 9, and
 * "Mulakai server cover decisions"): submit the source to the engine's SheetSage2 route,
 * poll, then keep the score on the job. Nothing is written to the library; the preview
 * stays on the engine and is proxied by routes/engines.ts.
 */
import crypto from 'node:crypto';
import { config } from '../config.js';
import { type Job, queueJob, wasAborted, drainWhile, MAX_POLL_STRIKES } from './jobs.js';
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

/** Ask the engine to stop an aborted transcription, then hold the queue's slot until it has. */
async function stopTranscription(engine: SongEngine, taskId: string): Promise<undefined> {
  await cancelTranscription(engine, taskId);
  await drainWhile(async () => (await transcriptionStatus(engine, taskId)).state === 'running');
  return undefined;
}

/** Resolves with the finished state, or undefined once aborted on our side (the engine is
 * then asked to stop too). Throws on a failed transcription. */
async function poll(job: Job, engine: SongEngine): Promise<TranscriptionState | undefined> {
  let strikes = 0;
  for (;;) {
    await new Promise((r) => setTimeout(r, config.pollIntervalMs));
    if (wasAborted(job)) {
      return stopTranscription(engine, job.taskId);
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
      return stopTranscription(engine, job.taskId);
    }
    if (state.state === 'failed') throw new Error(state.error ?? `${engine.label} transcription failed`);
    if (state.state === 'done') return state;
    job.progress = state.progress;
    job.progressStage = state.stage;
  }
}

/** Throws QueueFullError synchronously when the queue is full. */
export function startTranscription(engine: SongEngine, source: TranscribeSource): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'queued', createdAt: Date.now() };
  return queueJob({ kind: 'transcribe', title: source.label, engine: engine.id }, job, async () => {
    job.taskId = await transcribe(engine, source.data, source.filename, job.id);
    if (wasAborted(job)) {
      await stopTranscription(engine, job.taskId);
      return;
    }
    job.status = 'running';
    const finished = await poll(job, engine);
    if (!finished?.facts) return;
    const score = await fetchTranscriptionScore(engine, job.taskId);
    job.transcription = { ...finished.facts, score, sourceLabel: source.label };
    job.status = 'done';
  });
}
