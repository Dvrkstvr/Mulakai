/** The composer (D-095, TU-3): a text field and the outline text button SEND ↵, never a play-like glyph.
 * SEND is off while a turn is open or the assistant is off; what was typed stays. Enter sends, Shift+Enter
 * breaks the line. C3 (F-061): ATTACH ▾ left of the field (greyed on a song's thread, D-130), the one chip above it;
 * SEND also waits while a file uploads and from READ until the follow-up turn settles (D-129). */
import {
  COMPOSER_PLACEHOLDER, NOT_SENT, OFF_PLACEHOLDER, SEND_LABEL, SEND_WAITS, WAITING_FOR_V1, WAITING_PLACEHOLDER, notSentBody,
} from './chatCopy';
import { AttachChip, ChatAttachControl } from './ChatAttach';
import { attachBlocksSend, useChatAttachStore } from './chatAttachStore';
import { readingHoldsSend } from './chatReading';
import { SEND_WAITS_READING, SEND_WAITS_UPLOAD } from './chatReferenceCopy';
import { useChatStore } from './chatStore';
import { canSend, turnRunning, type TurnState } from './chatTurn';

interface Props {
  turn: TurnState;
  assistantOn: boolean;
  /** A take is rendering: a message sent now is read after v1 saves (TU-9). */
  committing: boolean;
  onType: (text: string) => void;
  onSend: () => void;
}

export function ChatComposer({ turn, assistantOn, committing, onType, onSend }: Props) {
  const threadId = useChatStore((s) => s.thread?.id ?? null);
  const songThread = useChatStore((s) => Boolean(s.thread?.songId));
  const reading = useChatStore((s) => readingHoldsSend(s.reading));
  const attachment = useChatAttachStore((s) => (threadId ? s.byThread[threadId] : undefined));
  const remove = useChatAttachStore((s) => s.remove);
  const running = turnRunning(turn);
  const uploading = attachBlocksSend(attachment);
  const live = canSend(turn, assistantOn) && !reading && !uploading;
  const note = running ? SEND_WAITS : reading ? SEND_WAITS_READING : uploading ? SEND_WAITS_UPLOAD : committing ? WAITING_FOR_V1 : null;
  const placeholder = !assistantOn ? OFF_PLACEHOLDER : running ? WAITING_PLACEHOLDER : COMPOSER_PLACEHOLDER;
  return (
    <div className="chat-composer">
      {turn.error && <div className="chat-er" role="alert"><div><b>{NOT_SENT}</b> {notSentBody(turn.error)}</div></div>}
      {note && <div className="chat-hn">{note}</div>}
      {attachment && threadId && <AttachChip a={attachment} onRemove={() => remove(threadId)} />}
      <div className="chat-composer-row">
        <ChatAttachControl threadId={threadId} off={songThread} />
        <textarea
          className="chat-input"
          aria-label="Message"
          rows={1}
          value={turn.text}
          placeholder={placeholder}
          disabled={!assistantOn}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
            e.preventDefault();
            if (live) onSend();
          }}
        />
        <button type="button" className="chat-send" disabled={!live} onClick={onSend}><span>{SEND_LABEL}</span></button>
      </div>
    </div>
  );
}
