/** COVER's engine-cover slice of the Create draft (PLAN.md "Client cover decisions"), kept out
 * of createDraftStore.ts, which is near the module cap. */
import type { Source } from './createDraft';
import type { Transcription } from './api';
import { coverSourceKey } from './coverSource';

/** The score an engine cover sings (PLAN.md "Client cover decisions"): from a TRANSCRIBE, a
 * USE .ABC FILE, or a reused cover. Only a transcribed one belongs to the source it came from. */
export interface CoverScore {
  abc: string;
  /** What it came from — a song title, a file name — stored with the cover as its source. */
  source: string;
  /** SheetSage2's report and preview; null for a score from a file or a reused cover. */
  transcription: Transcription | null;
  /** The TRANSCRIBE job, whose preview the server proxies; null without one. */
  previewJobId: string | null;
  /** Sections left out (indexes into the score's `% name` blocks), so a song too long for the
   * planner can still be covered; `sungScore` builds what is sent (PLAN.md "YuE2 Covers: Pick
   * the Score's Sections"). */
  dropped?: number[];
}

/** The part of COVER's draft slice a source change touches. */
interface CoverSourceState {
  source: Source;
  selectedSongId: string | null;
  uploadFile: File | null;
  yueScore: CoverScore | null;
}

/** A transcribed score describes its source, so picking another source drops it. A score
 * from a file or a reused cover isn't tied to the source, so it stays. "Another source" is
 * `coverSourceKey`'s, as for every job's result: re-picking the same file is a new `File`. */
export function withSourceChange<A extends CoverSourceState>(a: A, p: Partial<A>): A {
  const moved = coverSourceKey({ ...a, ...p }) !== coverSourceKey(a);
  return { ...a, ...(moved && a.yueScore?.transcription ? { yueScore: null } : {}), ...p };
}

/** What holds COVER's source still, as the picker's reason line names it, or null. */
export function sourceLockedBy(jobs: { transcribing: boolean; reading: boolean; analyzing: boolean; generating: boolean }): string | null {
  if (jobs.transcribing) return 'TRANSCRIBE';
  if (jobs.reading) return 'READ LYRICS';
  if (jobs.analyzing) return 'ANALYZE AUDIO';
  return jobs.generating ? 'a generation' : null;
}

/** What holds COVER's ENGINE choice still, or null: a job whose result lands in this engine's
 * draft. A generation doesn't — its result is a library song, and its retry keeps the engine. */
export function engineLockedBy(jobs: { transcribing: boolean; reading: boolean; analyzing: boolean }): string | null {
  return sourceLockedBy({ ...jobs, generating: false });
}
