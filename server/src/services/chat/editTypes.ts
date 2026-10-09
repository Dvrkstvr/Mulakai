/** The chat's edit types (C0b, CB-2; architecture.md "Data (chat)": the edit card's body). Types only. */
import type { Op, OpVerdict, Plan, ScoreFacts, Since } from '../score/planTypes.js';
import type { RenderMode } from '../score/renderMode.js';
import type { Splice } from './spliceEligibility.js';
import type { BarMap } from './convergeTypes.js';

/** The edit card (C0b, F-046): a planStore plan's snapshot. `splice` says whether APPLY splices the bars
 * (spliceEligibility) or re-renders the whole song, and why; `renderMode` names the render's cot (F-065).
 * C4 (D-266, additive): `splice.kind: 'several'` is a chain of 2-4 spans, `splice.steps` last bar first, each
 * `{ kind, from_bar, to_bar, ops }` (`ops`: the plan op indexes it covers); `from_bar`/`to_bar` stay first/last bar
 * touched. Cards stored before C4 never hold `several` and read as before. */
export interface EditBody {
  planId: string;
  ops: Op[];
  verdicts: OpVerdict[];
  checks: Plan['checks'];
  splice: Splice;
  renderMode: RenderMode;
  /** What the reply assumed ("assuming chorus 1, bars 25-32"). */
  assumptions: string[];
  attempts: number;
  /** Each earlier refused attempt's reasons (D-060). */
  refusals: string[][];
  /** C0b (CB-3, additive): APPLY's refusal once the song changed since the plan; the card reads STALE. */
  stale?: string;
  /** C1 (F-055, additive): the mark this plan was bounded to (null bars: a time only), and the card's notes: a
   * whole-song op, a mark clamped to the score, a phrase longer than the mark (D-176). */
  mark?: { versionId: string; bars: [number, number] | null; seconds: [number, number]; notes: string[] };
  /** The tempo and key the plan was read at (the SCORE dock's "from" values: 87 → 88 BPM). Additive: older cards lack it. */
  from?: { bpm: number; key: string };
  /** C2 (additive): a revised plan's number (REVISED · PLAN n) and its NEW / CHANGED / SAME + REMOVED (D-227); the
   * bar map that replaces the strip (D-215; a card without it draws the strip from `splice`). */
  revision?: number;
  since?: Since;
  map?: BarMap;
}
/** RT-6 (F-094, retime.html D4): a say that re-timed the playable version's reading in place; the thread's UNDO TURN
 * on it is the reading's UNDO (no version was made). `readAt`: the re-timed reading's stamp (UNDO TURN is offered only while
 * the playing reading has it); `asReadAt`: the reading as read, which UNDO restores (RT-6 review 3). */
export interface RetimeDoneBody {
  retime: { songId: string; versionId: string; number: number; mode: 'half' | 'double' | 'bpm'; bpm: number; fromBpm: number;
    fromBars: number; toBars: number; droppedNotes: number; notes: number; readAt: string; asReadAt: string };
}
/** What an edit turn plans on (songStateSource): an eligible song's score as read and its source. */
export interface EditBase {
  songId: string;
  source: { abc: string; style: string; lyrics: string | null; activeVersionId: string; fingerprint: string };
  facts: ScoreFacts;
  chordsPresent: boolean | null;
}
