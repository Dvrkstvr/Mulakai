import type { ActiveGeneration, EngineId } from './api';
import { taskToGenType } from './createDraft';
import type { GenerationJob, OtherLock } from './generationStore';

/** Whether a song generation still holds the server's lock. A failed job stays in the store
 * only so the Library card can show its error and RETRY — the server already released the
 * lock, so it must not block a new generation or any editor action. */
export function isGenerating(job: GenerationJob | null): boolean {
  return !!job && job.stage !== 'failed';
}

/** What each lock kind is called in a busy label — what the user pressed to start it. */
const LOCK_NAME: Record<ActiveGeneration['kind'], string> = {
  generate: 'A GENERATION', repaint: 'A REPAINT', regenerate: 'A REGENERATE', retake: 'A SIMILAR TAKE',
  addLayer: 'ADD LAYER', split: 'A STEM SPLIT', remaster: 'A REMASTER', transcribe: 'TRANSCRIBE',
  lyrics: 'READ LYRICS', analyze: 'ANALYZE AUDIO',
};

/** Why Create's commit buttons are off, naming what holds the server's lock — a song generation
 * this tab tracks, or anything else seen by refreshLock's poll (another tab's ANALYZE AUDIO, an
 * Editor repaint). Null when nothing does. The server would 409 a start either way. */
export function busyMessage(job: GenerationJob | null, otherLock: OtherLock | null): string | null {
  if (isGenerating(job)) return 'A GENERATION IS ALREADY RUNNING';
  if (!otherLock) return null;
  return `${LOCK_NAME[otherLock.kind] ?? 'ANOTHER JOB'} IS ALREADY RUNNING`;
}

/** Whether COVER · YUE2's TRANSCRIBE, READ LYRICS, ANALYZE AUDIO and GENERATE COVER are held off
 * by another job: a song generation still running, or the server's lock held by something other
 * than the panel's own transcription or read (`ownRunning`). A failed cover blocks nothing. */
export function coverLocked(job: GenerationJob | null, otherLock: unknown, ownRunning: boolean): boolean {
  return isGenerating(job) || (!!otherLock && !ownRunning);
}

/** A song generation found in the server's lock (after a reload, or started in another tab),
 * as our own job. It has no draft to recover, but the lock knows which task is running —
 * enough for RETRY to reopen the tab that started it instead of always dropping into PROMPT. */
export function adoptLock(active: ActiveGeneration): GenerationJob {
  return {
    jobId: active.jobId, title: active.title ?? 'Untitled', caption: active.caption ?? '',
    stage: active.status, error: active.error, startedAt: active.startedAt,
    draft: {
      genType: taskToGenType(active.task), prompt: active.caption,
      ...(active.engine ? { [active.task === 'cover' ? 'coverEngine' : 'engine']: active.engine as EngineId } : {}),
    },
  };
}
