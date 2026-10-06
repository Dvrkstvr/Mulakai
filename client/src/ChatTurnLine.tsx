/** The one line under a message that carries its turn (chat-turn.html TU-1, TU-2): dashed and plain while
 * QUEUED, the planner shader while THINKING, plain while CANCELLING; every ending without an answer (failed, off,
 * cancelled, interrupted) is one rust line with RETRY. Its copy is chatCopy's; its phase is chatTurn's. */
import type { ReactNode } from 'react';
import { AIGeneratingBackground } from './AIGeneratingBackground';
import {
  ASSISTANT_OFF, CANCELLED_BODY, CANCELLING, CANCELLING_TAIL, FAILED_TAIL, FORM_LINK, INTERRUPTED_LINE, QUEUED_TAIL,
  failedTitle, offBody, thinkingTail, turnLine,
} from './chatCopy';
import type { TurnState } from './chatTurn';

export function ChatJobLine({ title, tail, working, waiting, action }: {
  title: string; tail?: string | null; working?: boolean; waiting?: boolean; action?: ReactNode;
}) {
  return (
    <div className={`chat-job${working ? ' working' : ''}${waiting ? ' waiting' : ''}`}>
      {/* Only a turn or take the GPU is working on wears the shader (DESIGN.md "AI states"). */}
      {working && <AIGeneratingBackground />}
      <span className="chat-job-text"><b>{title}</b>{tail && <em> {tail}</em>}</span>
      {action}
    </div>
  );
}

export function ChatErrorLine({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="chat-er" role="alert">
      <div><b>{title}</b> {body}</div>
      {children}
    </div>
  );
}

const Cancel = ({ onClick, off }: { onClick?: () => void; off?: boolean }) => (
  <button type="button" className="chat-q" disabled={off} onClick={onClick}><span>CANCEL</span></button>
);
export const RetryButton = ({ onClick, label = 'RETRY' }: { onClick: () => void; label?: string }) => (
  <button type="button" className="chat-ao" onClick={onClick}><span>{label}</span></button>
);
export const FormButton = ({ onClick }: { onClick: () => void }) => (
  <button type="button" className="chat-q" onClick={onClick}><span>{FORM_LINK}</span></button>
);

interface Props {
  turn: TurnState;
  /** Frame 6: "you changed TEMPO since sending · …", while the turn runs. */
  touchedLine?: string | null;
  onCancel: () => void;
  onRetry: () => void;
  onForm: () => void;
}

export function ChatTurnLine({ turn, touchedLine, onCancel, onRetry, onForm }: Props) {
  const p = turn.phase;
  if ((p.kind === 'queued' || p.kind === 'thinking') && turn.cancelling) {
    return <ChatJobLine title={CANCELLING} tail={CANCELLING_TAIL} action={<Cancel off />} />;
  }
  switch (p.kind) {
    case 'sending': return <ChatJobLine title={turnLine(turn)!} waiting />;
    case 'queued': return <ChatJobLine title={turnLine(turn)!} tail={QUEUED_TAIL} waiting action={<Cancel onClick={onCancel} />} />;
    case 'thinking':
      return (
        <>
          <ChatJobLine title={turnLine(turn)!} tail={thinkingTail(p.attempt, p.note)} working action={<Cancel onClick={onCancel} />} />
          {touchedLine && <div className="chat-hn">{touchedLine}</div>}
        </>
      );
    case 'cancelled':
      return <ChatErrorLine title="CANCELLED" body={CANCELLED_BODY}><RetryButton onClick={onRetry} /></ChatErrorLine>;
    case 'interrupted':
      return <ChatErrorLine title="INTERRUPTED" body={INTERRUPTED_LINE}><RetryButton onClick={onRetry} /></ChatErrorLine>;
    case 'failed':
      return (
        <ChatErrorLine title={failedTitle(p.cause)} body={`${p.reasons.join(' · ')}. ${FAILED_TAIL}`}>
          <RetryButton onClick={onRetry} /><FormButton onClick={onForm} />
        </ChatErrorLine>
      );
    case 'offline':
      return (
        <ChatErrorLine title={ASSISTANT_OFF} body={offBody(p.cause)}>
          <RetryButton onClick={onRetry} /><FormButton onClick={onForm} />
        </ChatErrorLine>
      );
    default: return null;
  }
}
