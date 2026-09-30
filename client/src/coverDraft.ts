/** COVER's engine-cover slice of the Create draft (PLAN.md "Client cover decisions"), kept out
 * of createDraftStore.ts, which is near the module cap. */
import type { Source } from './createDraft';
import type { Transcription } from './api';

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
}

/** The part of COVER's draft slice a source change touches. */
interface CoverSourceState {
  source: Source;
  selectedSongId: string | null;
  uploadFile: File | null;
  yueScore: CoverScore | null;
}

/** A transcribed score describes its source, so picking another source drops it. A score
 * from a file or a reused cover isn't tied to the source, so it stays. */
export function withSourceChange<A extends CoverSourceState>(a: A, p: Partial<A>): A {
  const moved = ('source' in p && p.source !== a.source)
    || ('selectedSongId' in p && p.selectedSongId !== a.selectedSongId)
    || ('uploadFile' in p && p.uploadFile !== a.uploadFile);
  return { ...a, ...(moved && a.yueScore?.transcription ? { yueScore: null } : {}), ...p };
}
