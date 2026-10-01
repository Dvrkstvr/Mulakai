import type { ActiveGeneration, EngineId } from './api';
import { taskToGenType } from './createDraft';
import { isEditorBusy, type SingleEditorJob } from './editorJob';
import type { GenerationJob, OtherLock } from './generationStore';

/** Whether a song generation still holds the server's lock. A failed job stays in the store
 * only so the Library card can show its error and RETRY — the server already released the
 * lock, so it must not block a new generation or any editor action. */
export function isGenerating(job: GenerationJob | null): boolean {
  return !!job && job.stage !== 'failed';
}

/** What each lock kind is called in a busy label — what the user pressed to start it. */
const LOCK_NAME: Record<ActiveGeneration['kind'], string> = {
  generate: 'A GENERATION', repaint: 'A REPAINT', regenerate: 'AN ALT TAKE', retake: 'A SIMILAR TAKE',
  addLayer: 'ADD LAYER', split: 'A STEM SPLIT', remaster: 'A REMASTER', transcribe: 'TRANSCRIBE',
  lyrics: 'READ LYRICS', timings: 'WORD TIMINGS', analyze: 'ANALYZE AUDIO',
};

/** What holds the server's lock, as a busy label names it: a split extracting in this tab, this
 * tab's song generation, this tab's editor job, or whatever refreshLock's poll saw (another tab's
 * ANALYZE AUDIO, say). Null when none does. Callers decide *whether* they're blocked (each excludes
 * its own job); this only says by what, so check it after that decision. */
export function lockHolder(s: {
  generating: boolean; otherLock: OtherLock | null; editorJob?: SingleEditorJob | null; splitRunning?: boolean;
}): string | null {
  if (s.splitRunning) return LOCK_NAME.split;
  if (s.generating) return LOCK_NAME.generate;
  if (s.editorJob && isEditorBusy(s.editorJob)) return LOCK_NAME[s.editorJob.kind];
  return s.otherLock ? LOCK_NAME[s.otherLock.kind] ?? 'ANOTHER JOB' : null;
}

/** A commit button's label while `holder` has the lock, in Create and the Editor alike. Kept short:
 * "… IS ALREADY RUNNING" wrapped on the Editor's rail buttons and squeezed REPAINT REGION's prompt.
 * At most 23 characters, one line in the rail. */
export function waitLabel(holder: string): string {
  return `WAIT FOR ${holder}`;
}

/** Why Create's commit buttons are off (a song generation this tab tracks, or anything the poll
 * saw), or null. The server would 409 a start either way. */
export function busyMessage(job: GenerationJob | null, otherLock: OtherLock | null): string | null {
  const holder = lockHolder({ generating: isGenerating(job), otherLock });
  return holder && waitLabel(holder);
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
