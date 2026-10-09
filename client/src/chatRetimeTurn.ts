/** UNDO TURN on a turn that re-timed the reading (RT-6, F-094; retime.html D4): no version was made, so the turn's undo is
 * the reading's own UNDO, offered only while the playing version's reading is still this turn's re-time. Pure. */
import type { AnalysisView } from './api/chatAnalysis';
import type { ChatRetimeDoneBody } from './api/chatRetime';

/** `offer`: UNDO TURN (held while a reply is open); `done`: the reading is back as read; `changed`: re-timed again since,
 * another version plays, or the view is not read yet: the CHANGED line alone. */
export type RetimeTurnLine = { kind: 'offer'; disabled: boolean } | { kind: 'done' } | { kind: 'changed' };

export function retimeTurnLine(r: ChatRetimeDoneBody['retime'], view: AnalysisView | null, turnOpen: boolean): RetimeTurnLine {
  const offer = view?.versionId === r.versionId && view.shown?.versionId === r.versionId ? view.shown.retime : null;
  if (!offer) return { kind: 'changed' };
  if (!offer.retimed) return { kind: 'done' };
  return offer.retimed.mode === r.mode && offer.retimed.bpm === r.bpm ? { kind: 'offer', disabled: turnOpen } : { kind: 'changed' };
}
