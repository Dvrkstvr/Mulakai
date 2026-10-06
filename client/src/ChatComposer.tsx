/** The composer (D-095, TU-3): a text field and the outline text button SEND ↵, never a play-like glyph.
 * SEND is off while a turn is open or the assistant is off; what was typed stays. Enter sends, Shift+Enter
 * breaks the line. */
import {
  COMPOSER_PLACEHOLDER, NOT_SENT, OFF_PLACEHOLDER, SEND_LABEL, SEND_WAITS, WAITING_FOR_V1, WAITING_PLACEHOLDER, notSentBody,
} from './chatCopy';
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
  const running = turnRunning(turn);
  const live = canSend(turn, assistantOn);
  const note = running ? SEND_WAITS : committing ? WAITING_FOR_V1 : null;
  const placeholder = !assistantOn ? OFF_PLACEHOLDER : running ? WAITING_PLACEHOLDER : COMPOSER_PLACEHOLDER;
  return (
    <div className="chat-composer">
      {turn.error && <div className="chat-er" role="alert"><div><b>{NOT_SENT}</b> {notSentBody(turn.error)}</div></div>}
      {note && <div className="chat-hn">{note}</div>}
      <div className="chat-composer-row">
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
