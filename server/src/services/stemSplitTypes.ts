/** Stem kinds, job shapes, and per-stem extract instructions shared by the split
 * orchestrator (stemSplit.ts) and its ACE-Step/Demucs runners. */
import type { OutputSettings } from './audioOutput.js';

export type StemKind = 'vocals' | 'drums' | 'bass' | 'other';
export type SplitModel = 'acestep' | 'demucs';

export interface StemResult {
  kind: StemKind;
  status: 'running' | 'done' | 'failed';
  audioFile?: string;
  error?: string;
  claimed?: 'replaced' | 'added';
}

/** Minimal shape `runAcestepStem`/`runDemucs`/`pollStem` need — satisfied by both `SplitJob`
 * (stemSplit.ts) and `ScratchSplitJob` (scratchSplitJobs.ts), which has no layer/song to belong to. */
export interface StemJobLike {
  id: string;
  stems: StemResult[];
  /** Output format/rate/depth chosen when the job started — stems honour the
   * same Settings block as generation output. */
  output: OutputSettings;
}

export interface SourceAudio {
  data: Buffer;
  filename: string;
}

export const STEM_KINDS: StemKind[] = ['vocals', 'drums', 'bass', 'other'];

export const INSTRUCTIONS: Record<StemKind, string> = {
  vocals: 'Extract the vocals from this audio, isolating the vocal track.',
  drums: 'Extract the drums from this audio, isolating the drum track.',
  bass: 'Extract the bass from this audio, isolating the bass track.',
  other: 'Extract the remaining instrumental elements (excluding vocals, drums, and bass) from this audio.',
};
