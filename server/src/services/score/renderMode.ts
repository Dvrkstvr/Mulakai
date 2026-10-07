/**
 * The render's YuE2 mode (F-065, D-132): `cot: 'full'` when the score as read has chords or the plan
 * writes some (any REHARMONIZE: on a chord-free score it adds chords, and the whole song then renders
 * with them), else `cot: 'melody'` (a cover's transcription, a melody-only score). Pure. The plan
 * carries the answer (planJob) and the render sends its cot (scoreRenderJob); never hard-code it.
 */
import type { Op } from './planTypes.js';

export type RenderCot = 'full' | 'melody';
/** Why: the read had chords, a REHARMONIZE adds them, or there are none (melody only). */
export type RenderReason = 'chords' | 'reharmonize' | 'melody';

export interface RenderMode { cot: RenderCot; reason: RenderReason }

/** `chordsPresent` is the read's verdict on the base score (null = unknown, treated as none). */
export function renderMode(input: { chordsPresent: boolean | null; ops: Op[] }): RenderMode {
  if (input.chordsPresent === true) return { cot: 'full', reason: 'chords' };
  if (input.ops.some((o) => o.op === 'REHARMONIZE')) return { cot: 'full', reason: 'reharmonize' };
  return { cot: 'melody', reason: 'melody' };
}
