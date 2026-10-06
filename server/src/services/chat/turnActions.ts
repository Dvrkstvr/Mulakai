/**
 * Which actions a turn may answer with (SP-5's closed set) and which of them C0a answers as a plain
 * `say` (D-098, D-110). Pure. SP-5's ladder rung 2 ("offer only the actions the state allows") lives
 * here; the number of calls lives in turnCall.ts. CB-2 turns edits on (EDITS_ON). C3: the draft thread
 * answers `analyze` with a READ card; the follow-up turn after a reading proposes or asks (D-129).
 */
import type { TurnAction } from './chatTypes.js';

export const ACTIONS: TurnAction[] = ['ask', 'recipe', 'edit', 'scalpel', 'analyze', 'say'];

/** C0a: an edit turn is answered by pointing to SCORE in the Editor (D-110). */
export const EDITS_ON = false;

export interface TurnState {
  /** The thread belongs to a song (else it is the draft thread). */
  hasSong: boolean;
  /** The song's score was read (yue-server answered, the sidecar passed). */
  scoreReadable: boolean;
  /** C3: the thread has an attached reference not read yet. */
  attached?: boolean;
  /** C3: a reading is in the state (the REFERENCE block; the recipe gains `reference_use`). */
  referenceRead?: boolean;
  /** C3: the turn the server queued after a reading (D-129). */
  followUp?: boolean;
}

const FOLLOW_UP: TurnAction[] = ['ask', 'recipe', 'say'];

/** Rung 0/1 (default): the whole set, as SP-5 measured it. Rung 2: nothing to edit or repaint
 * without a song, no edit without a readable score. */
export function allowedActions(s: TurnState, rung = 0): TurnAction[] {
  if (s.followUp) return [...FOLLOW_UP];
  if (rung < 2) return [...ACTIONS];
  if (!s.hasSong) return ['ask', 'recipe', 'analyze', 'say'];
  return s.scoreReadable ? [...ACTIONS] : ['ask', 'recipe', 'scalpel', 'analyze', 'say'];
}

/** Actions whose details this version never uses: the reply becomes a `say` naming where the
 * request can be done, so they are checked for shape only (no retry spent on their content). */
export function redirected(s: TurnState, editsOn = EDITS_ON): TurnAction[] {
  const out: TurnAction[] = ['scalpel'];
  if (s.hasSong) out.push('analyze');
  if (!editsOn || !s.hasSong) out.push('edit');
  if (s.hasSong) out.push('recipe');
  return out;
}
