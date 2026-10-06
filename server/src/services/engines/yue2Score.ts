/**
 * The YuE2 job body for APPLY & RENDER (F-023, D-010, D-023): the edited score as `abc` with the
 * plan's render mode (`renderMode`: `full` when the score has chords or the plan adds some, `melody`
 * for a chord-free score, F-065/D-132), the plan's style (yue-server already rewrote its bpm when the
 * plan sets a tempo, D-047), the plan's lyrics (the base version's exactly as stored, unless a section
 * op or REWRITE_LYRICS edited them on yue-server, F-030/F-031), and the base version's seed.
 * `buildYue2CoverRequest` (cot `melody`) is a different path and unchanged.
 */
import type { RenderCot } from '../score/renderMode.js';

export interface ScoreRenderInput {
  /** The plan's edited score. */
  abc: string;
  /** The plan's style: the stored style after the ops. */
  style: string;
  /** The plan's edited lyrics, else the active base version's stored lyrics; never re-derived here. */
  lyrics: string;
  seed: number;
  /** The plan's renderMode cot; never hard-coded. */
  cot: RenderCot;
}

export type ScoreRenderRequest = ScoreRenderInput;

export function buildYue2ScoreRequest(input: ScoreRenderInput): ScoreRenderRequest {
  return { abc: input.abc, cot: input.cot, style: input.style, lyrics: input.lyrics, seed: input.seed };
}
