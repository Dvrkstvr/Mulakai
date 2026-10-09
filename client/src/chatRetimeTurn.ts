/** UNDO TURN on a turn that re-timed the reading (RT-6, F-094; retime.html D4): no version was made, so the turn's undo is
 * the reading's own UNDO, offered only while the playing version's reading is still this turn's re-time: the same
 * `readAt` the turn wrote (RT-6 review 3; an identical later re-time has its own). Pure. */
import type { AnalysisView } from './api/chatAnalysis';
import type { ChatRetimeDoneBody } from './api/chatRetime';

/** `offer`: UNDO TURN (held while a reply is open); `done`: the reading is back as read (UNDO restored its `readAt`);
 * `since`: the reading changed since (re-timed again, or read again); `changed`: another version plays, or the view is not
 * read yet: the CHANGED line alone. */
export type RetimeTurnLine = { kind: 'offer'; disabled: boolean } | { kind: 'done' } | { kind: 'since' } | { kind: 'changed' };

export function retimeTurnLine(r: ChatRetimeDoneBody['retime'], view: AnalysisView | null, turnOpen: boolean): RetimeTurnLine {
  const shown = view?.versionId === r.versionId && view.shown?.versionId === r.versionId ? view.shown : null;
  if (!shown?.retime || !r.readAt) return { kind: 'changed' };
  if (shown.readAt === r.readAt && shown.retime.retimed) return { kind: 'offer', disabled: turnOpen };
  return shown.readAt === r.asReadAt && !shown.retime.retimed ? { kind: 'done' } : { kind: 'since' };
}
