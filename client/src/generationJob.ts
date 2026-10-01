import type { ActiveGeneration, EngineId } from './api';
import { taskToGenType } from './createDraft';
import type { GenerationJob } from './generationStore';

/** Whether a song generation still holds the server's lock. A failed job stays in the store
 * only so the Library card can show its error and RETRY — the server already released the
 * lock, so it must not block a new generation or any editor action. */
export function isGenerating(job: GenerationJob | null): boolean {
  return !!job && job.stage !== 'failed';
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
