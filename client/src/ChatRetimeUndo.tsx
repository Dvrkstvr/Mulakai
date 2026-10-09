/** The CHANGED line under a turn that re-timed the reading (RT-6, F-094; retime.html D4), with UNDO TURN: the reading's
 * own UNDO through the analysis store (`undoRetime`), so the strip, the READ AS row and a mark follow at once. When the
 * reply lands on a view that does not show the re-time yet, the view is read again once, and until then the line is the
 * CHANGED line alone, never UNDONE (D-281: the view the reply landed on may predate the turn). */
import { useEffect, useRef, useState } from 'react';
import type { AnalysisView } from './api/chatAnalysis';
import type { ChatMessageView } from './api/chat';
import type { ChatRetimeDoneBody } from './api/chatRetime';
import { useChatAnalysisStore } from './chatAnalysisStore';
import { RETIME_CHANGED, RETIME_SINCE, RETIME_UNDONE, UNDONE, UNDO_OFF, UNDO_TURN, undoRefusedLine } from './chatConvergeCopy';
import { retimeNeedsRead, retimeTurnLine } from './chatRetimeTurn';
import './chatUndo.css';

const why = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function ChatRetimeUndo({ message, view, turnOpen }: { message: ChatMessageView; view: AnalysisView | null; turnOpen: boolean }) {
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [viewAtReply] = useState(view);
  const r = (message.body as ChatRetimeDoneBody | null)?.retime ?? null;
  const fresh = view !== viewAtReply; // a view read since the reply appeared (D-281)
  const line = r ? retimeTurnLine(r, view, turnOpen, fresh) : null;
  const stale = !fresh && r !== null && retimeNeedsRead(r, view);
  const asked = useRef(false);
  useEffect(() => {
    const store = useChatAnalysisStore.getState();
    if (!stale || !r || asked.current) return;
    asked.current = true; // once per reply
    void store.open(r.songId, store.threadId);
  }, [message.id, stale]); // eslint-disable-line react-hooks/exhaustive-deps -- r is read with stale
  if (!r || !line) return null;
  if (line.kind === 'done') return <div className="chat-hn chat-changed">{`${UNDONE} · ${RETIME_UNDONE}`}</div>;
  const undo = async () => {
    setBusy(true);
    setRefused(null);
    try {
      await useChatAnalysisStore.getState().undoRetime();
    } catch (err) {
      setRefused(why(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="chat-hn chat-changed">
      {RETIME_CHANGED}
      {line.kind === 'since' && ` · ${RETIME_SINCE}`}
      {line.kind === 'offer' && (
        <>
          <button type="button" className="chat-link chat-undo" disabled={line.disabled || busy} onClick={() => void undo()}>{UNDO_TURN}</button>
          {line.disabled && <span className="chat-undo-off"> · {UNDO_OFF}</span>}
        </>
      )}
      {refused && <div className="chat-fd-problem">{undoRefusedLine(refused)}</div>}
    </div>
  );
}
