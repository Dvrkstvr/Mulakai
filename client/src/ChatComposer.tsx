/** The composer (D-095, TU-3): a text field and the outline text button SEND ↵, never a play-like glyph.
 * SEND is off while a turn is open or the assistant is off; what was typed stays. Enter sends, Shift+Enter
 * breaks the line. C3 (F-061): ATTACH ▾ left of the field (greyed on a song's thread, D-130), the one chip above it;
 * SEND also waits while a file uploads and from READ until the follow-up turn settles (D-129). C1 (F-054, F-055;
 * chat-mark.html MK-6, MK-8, MK-9): the mark's chip above the field and one line under it: the mark's consequence,
 * "a message sent now starts after the reading" while one runs (SEND stays live and queues, Q-069), or, for a stale
 * mark, why SEND is held until USE BARS or CLEAR MARK. */
import {
  COMPOSER_PLACEHOLDER, NOT_SENT, OFF_PLACEHOLDER, SEND_LABEL, SEND_WAITS, WAITING_FOR_V1, WAITING_PLACEHOLDER, notSentBody,
} from './chatCopy';
import { AttachChip, ChatAttachControl } from './ChatAttach';
import { attachBlocksSend, useChatAttachStore } from './chatAttachStore';
import { analysisRunning, analysisWaitLine } from './chatAnalysis';
import { useChatAnalysisStore } from './chatAnalysisStore';
import { ChatMarkChip } from './ChatMarkChip';
import { SEND_HELD, markConsequence, sendHeldLine } from './chatMarkLabel';
import { useChatMarkStore } from './chatMarkStore';
import { readingHoldsSend } from './chatReading';
import { SEND_WAITS_READING, SEND_WAITS_UPLOAD } from './chatReferenceCopy';
import { useChatStore } from './chatStore';
import { canSend, turnRunning, type TurnState } from './chatTurn';

interface Props {
  turn: TurnState;
  assistantOn: boolean;
  /** A take is rendering: a message sent now is read after v1 saves (TU-9). */
  committing: boolean;
  /** C0b: what the wait says on a song's thread while APPLY runs ("WAITING FOR v2 …"); absent = WAITING FOR v1. */
  waitingLine?: string | null;
  onType: (text: string) => void;
  onSend: () => void;
}

export function ChatComposer({ turn, assistantOn, committing, waitingLine, onType, onSend }: Props) {
  const threadId = useChatStore((s) => s.thread?.id ?? null);
  const songThread = useChatStore((s) => Boolean(s.thread?.songId));
  const reading = useChatStore((s) => readingHoldsSend(s.reading));
  const attachment = useChatAttachStore((s) => (threadId ? s.byThread[threadId] : undefined));
  const remove = useChatAttachStore((s) => s.remove);
  const mark = useChatMarkStore((s) => (threadId ? s.byThread[threadId] : undefined));
  const analysis = useChatAnalysisStore((s) => s.analysis);
  const running = turnRunning(turn);
  const uploading = attachBlocksSend(attachment);
  const held = !!mark?.stale;
  const live = canSend(turn, assistantOn) && !reading && !uploading && !held;
  const note = running ? SEND_WAITS : reading ? SEND_WAITS_READING : uploading ? SEND_WAITS_UPLOAD : committing ? waitingLine ?? WAITING_FOR_V1 : null;
  const waits = songThread ? analysisWaitLine(analysis) : null;
  const line = mark?.stale ? sendHeldLine(mark.stale.useBars) : note ? null : waits ?? (mark ? markConsequence(mark.mark) : null);
  const placeholder = !assistantOn ? OFF_PLACEHOLDER : running ? WAITING_PLACEHOLDER : held ? SEND_HELD : COMPOSER_PLACEHOLDER;
  return (
    <div className="chat-composer">
      {turn.error && <div className="chat-er" role="alert"><div><b>{NOT_SENT}</b> {notSentBody(turn.error)}</div></div>}
      {note && <div className="chat-hn">{note}</div>}
      {attachment && threadId && <AttachChip a={attachment} onRemove={() => remove(threadId)} />}
      {threadId && songThread && (
        <ChatMarkChip threadId={threadId} sections={analysis.view?.shown?.sections ?? []} reading={analysisRunning(analysis)} />
      )}
      {line && <div className={`chat-cxl${held ? ' bad' : ''}`} aria-label="Mark line">{line}</div>}
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
