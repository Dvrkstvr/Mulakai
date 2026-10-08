/** A recipe reply's CHANGED line with UNDO TURN on it (F-059, chat-converge.html 5a-5c, CX-4, D-229): the link while
 * the server offers it, greyed with its reason while a reply is open; after it, the line reads UNDONE · restored … ·
 * kept …: reason instead, from the message body so a reload shows the same. No link when the turn filled nothing or
 * the song exists (`undoLine`). */
import { useState } from 'react';
import type { ChatMessageView, ChatThreadView } from './api/chat';
import type { ChatMessageViewC2, ChatRecipeBodyC2, RecipeUndone } from './api/chatConverge';
import { UNDONE, UNDO_OFF, UNDO_TURN, undoRefusedLine, undoneLine } from './chatConvergeCopy';
import { useChatDraftStore } from './chatDraftStore';
import { useChatStore } from './chatStore';
import { undoLine } from './chatUndo';
import './chatUndo.css';

/** The thread as the server now holds it after an undo: the body's `undone`, the view's `undo: 'done'`. */
function markUndone(thread: ChatThreadView, id: string, undone: RecipeUndone): ChatThreadView {
  const messages = thread.messages.map((m): ChatMessageView => (m.id !== id ? m
    : { ...m, body: { ...(m.body as ChatRecipeBodyC2), undone }, undo: 'done' } as ChatMessageViewC2));
  return { ...thread, messages };
}

interface Props {
  message: ChatMessageView;
  /** `CHANGED · TITLE, STYLE` (null: the turn filled nothing). */
  changed: string | null;
  /** The thread's song, or the card's own when it made one. */
  songId: string | null;
  /** A reply is being written. */
  turnOpen: boolean;
}

export function ChatUndoLine({ message, changed, songId, turnOpen }: Props) {
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const line = undoLine(message as ChatMessageViewC2, songId, turnOpen);

  if (line?.kind === 'done') {
    const u = line.undone;
    return <div className="chat-hn chat-changed">{UNDONE}{u ? ` · ${undoneLine(u.restored, u.kept)}` : ''}</div>;
  }
  if (!changed) return null;
  const undo = async () => {
    setBusy(true);
    setRefused(null);
    try {
      const res = await useChatDraftStore.getState().undo(message.id);
      if ('refused' in res) return setRefused(res.refused);
      const thread = useChatStore.getState().thread;
      const undone: RecipeUndone = { at: Date.now(), restored: res.restored, kept: res.kept };
      if (thread) useChatStore.setState({ thread: markUndone(thread, message.id, undone) });
    } catch (err) {
      setRefused(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="chat-hn chat-changed">
      {changed}
      {line && (
        <>
          <button type="button" className="chat-link chat-undo" disabled={line.disabled || busy} onClick={() => void undo()}>{UNDO_TURN}</button>
          {line.disabled && <span className="chat-undo-off"> · {UNDO_OFF}</span>}
        </>
      )}
      {refused && <div className="chat-fd-problem">{undoRefusedLine(refused)}</div>}
    </div>
  );
}
