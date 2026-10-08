import type { ActiveGeneration, EngineId } from './api';
import { taskToGenType } from './createDraft';
import type { GenerationJob } from './generationStore';

/** Whether a song generation is still in flight (waiting in the queue, loading or running). A
 * failed job stays in the store only so its Library card can show the error and RETRY. */
export function isGenerating(job: GenerationJob | null | undefined): boolean {
  return !!job && job.stage !== 'failed';
}

let seq = 0;
export const newGenKey = (): string => `generate-${Date.now().toString(36)}-${(seq += 1)}`;

/** A song generation found running on the server (after a reload, or started in another tab),
 * as one of our own jobs. It has no draft to recover, but the server knows which task is
 * running — enough for RETRY to reopen the card that started it instead of always AN IDEA. */
export function adoptLock(active: ActiveGeneration): GenerationJob {
  return {
    key: newGenKey(),
    jobId: active.jobId, title: active.title ?? 'Untitled', caption: active.caption ?? '',
    stage: active.status, error: active.error, startedAt: active.startedAt, ...(active.origin ? { origin: active.origin } : {}),
    draft: {
      genType: taskToGenType(active.task), prompt: active.caption,
      ...(active.engine ? { [active.task === 'cover' ? 'coverEngine' : 'engine']: active.engine as EngineId } : {}),
    },
  };
}

/** The songs whose take landed since `seen` (the Library refreshes for them) and the one its footer player loads: the
 * newest Create take. A chat take never loads there: the chat's own player plays it (owner, 2026-10-08). */
export function landedTakes(jobs: GenerationJob[], seen: ReadonlySet<string>): { fresh: string[]; play: string | null } {
  const done = jobs.filter((j) => j.stage === 'done' && j.songId && !seen.has(j.songId));
  const library = done.filter((j) => j.origin !== 'chat');
  return { fresh: done.map((j) => j.songId as string), play: library.at(-1)?.songId ?? null };
}
