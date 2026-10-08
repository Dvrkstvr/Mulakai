/** UNDO TURN under a recipe reply (F-059, chat-converge.html 5a-5c, CX-4, D-229): a link while the server offers it,
 * greyed with its reason while a reply is open; after it, UNDONE · restored … · kept …: reason, read from the message
 * body so a reload shows the same line. Absent when the turn filled nothing or the song exists (`undoLine`). */
import { useState } from 'react';
import type { ChatMessageView, ChatThreadView } from './api/chat';
import type { ChatMessageViewC2, ChatRecipeBodyC2, RecipeUndone } from './api/chatConverge';
import { UNDO_TURN, undoRefusedLine, undoneLine } from './chatConvergeCopy';
import { useChatDraftStore } from './chatDraftStore';
import { useChatStore } from './chatStore';
import { undoLine } from './chatUndo';

const UNDO_OFF_REASON = 'off while a reply is open';
const UNDONE = 'UNDONE';
/** Under the reply's CHANGED line, at its text's indent (`.chat-am`: 2px rule + 12px), not a new block (no CSS file here). */
const AT_REPLY = { paddingLeft: 14, marginTop: -6 } as const;

/** The thread as the server now holds it after an undo: the body's `undone`, the view's `undo: 'done'`. */
function markUndone(thread: ChatThreadView, id: string, undone: RecipeUndone): ChatThreadView {
  const messages = thread.messages.map((m): ChatMessageView => (m.id !== id ? m
    : { ...m, body: { ...(m.body as ChatRecipeBodyC2), undone }, undo: 'done' } as ChatMessageViewC2));
  return { ...thread, messages };
}

/** `songId`: the thread's song, or the card's own when it made one; `turnOpen`: a reply is being written. */
export function ChatUndoLine({ message, songId, turnOpen }: { message: ChatMessageView; songId: string | null; turnOpen: boolean }) {
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const line = undoLine(message as ChatMessageViewC2, songId, turnOpen);
  if (!line) return null;

  if (line.kind === 'done') {
    const u = line.undone;
    return <div className="chat-hn chat-changed chat-undo" style={AT_REPLY}>{UNDONE}{u ? ` · ${undoneLine(u.restored, u.kept)}` : ''}</div>;
  }
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
    <div className="chat-hn chat-undo" style={AT_REPLY}>
      <button type="button" className="chat-link" disabled={line.disabled || busy} style={line.disabled ? { opacity: 0.4 } : undefined}
        onClick={() => void undo()}>{UNDO_TURN}</button>
      {line.disabled && <span> · {UNDO_OFF_REASON}</span>}
      {refused && <div className="chat-fd-problem">{undoRefusedLine(refused)}</div>}
    </div>
  );
}
