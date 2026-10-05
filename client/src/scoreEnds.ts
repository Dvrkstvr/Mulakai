/** F-027: the first ACE-Step edit on a song ends score editing there (D-006: no repaint versions,
 * one layer), so while SCORE is still open, the consequence line of REPAINT, ADD LAYER and a
 * stem's extract-to-layer ends with this rust-body clause (D-030's wording until M3's NEW SONG
 * FROM THIS SCORE exists). REMASTER MIX never saves to the song, so it leaves SCORE open. Pure. */
import type { ScoreVerbState } from './scoreVerbTypes';
import { SCORE_ENDS } from './scoreCopy';

/** SCORE is still open: its tab is on show and the song is not ineligible. Offline counts as
 * open (the planner or checker being down does not stop the edit from closing it). */
export const scoreOpen = (s: ScoreVerbState): boolean => s.phase.kind !== 'hidden' && s.phase.kind !== 'ineligible';

/** An ACE-Step edit's consequence line, and the clause it ends with (null = none). */
export interface EditConsequence { line: string; scoreEnds: string | null }

export const editConsequence = (line: string, open: boolean): EditConsequence => ({ line, scoreEnds: open ? SCORE_ENDS : null });
