/** UNDO TURN on a turn that re-timed the reading (RT-6, F-094; retime.html D4): no version was made, so the turn's undo is
 * the reading's own UNDO, offered only while the playing version's reading is still this turn's re-time: the same
 * `readAt` the turn wrote (RT-6 review 3; an identical later re-time has its own). Pure. */
import type { AnalysisView } from './api/chatAnalysis';
import type { ChatRetimeDoneBody } from './api/chatRetime';

/** `offer`: UNDO TURN (held while a reply is open); `done`: the reading is back as read (UNDO restored its `readAt`);
 * `since`: the reading changed since (re-timed again, or read again); `changed`: another version plays, or the view is not
 * read yet: the CHANGED line alone. */
export type RetimeTurnLine = { kind: 'offer'; disabled: boolean } | { kind: 'done' } | { kind: 'since' } | { kind: 'changed' };

const shownOf = (r: ChatRetimeDoneBody['retime'], view: AnalysisView | null) =>
  (view?.versionId === r.versionId && view.shown?.versionId === r.versionId ? view.shown : null);

/** `fresh`: the view was read after the reply appeared. A view that may predate the turn and shows a reading older than
 * the turn's re-time is loading (the CHANGED line alone), never UNDONE: UNDO restores that same older stamp (D-281). */
export function retimeTurnLine(r: ChatRetimeDoneBody['retime'], view: AnalysisView | null, turnOpen: boolean, fresh = true): RetimeTurnLine {
  const shown = shownOf(r, view);
  if (!shown?.retime || !r.readAt) return { kind: 'changed' };
  if (shown.readAt === r.readAt && shown.retime.retimed) return { kind: 'offer', disabled: turnOpen };
  if (!fresh && (shown.readAt ?? '') < r.readAt) return { kind: 'changed' };
  return shown.readAt === r.asReadAt && !shown.retime.retimed ? { kind: 'done' } : { kind: 'since' };
}

/** The reply's view must be read again (once): it plays the turn's version but not yet its re-time, or shows a reading
 * older than it (a view read before the turn: the READ AS and tempo rows still the old values). */
export function retimeNeedsRead(r: ChatRetimeDoneBody['retime'], view: AnalysisView | null): boolean {
  if (view?.versionId !== r.versionId) return false;
  const shown = shownOf(r, view);
  return !shown?.retime || !r.readAt || (shown.readAt ?? '') < r.readAt;
}
