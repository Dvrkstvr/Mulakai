/** The READ card (F-061, design/chat-reference.html 2a/2b): what will be read, the rights line (D-134), READ's
 * consequence and READ, the card's one acid fill, whose label never turns into progress. No GPU seconds until CP-C3
 * calibrates them (D-141, Q-099): the line says "uses the GPU", or "uses no GPU" when nothing runs there. Its phase is
 * `chatReading`'s; superseded and expired lose the button, done folds to its header above the reading card. */
import type { ChatAnalyzeBody, ChatMessageView } from './api/chat';
import type { ReferenceView } from './api/chatReferences';
import type { CardState } from './chatReading';
import {
  ANALYZE_HEAD, ANALYZE_TAIL, READ, RIGHTS_LINE, analyzeDone, analyzeLine, analyzeMeta, cutNote, layersNote, readConsequence,
} from './chatReferenceCopy';
import { ChatErrorLine } from './ChatTurnLine';

interface Props {
  message: ChatMessageView;
  card: CardState | undefined;
  /** The attached reference the card reads (layers, origin); absent for a library song named in words. */
  reference: ReferenceView | undefined;
  /** Jobs ahead in the GPU queue: READ's line says when it starts. */
  ahead: number;
  onRead: () => void;
}

export function ChatAnalyzeCard({ message, card, reference, ahead, onRead }: Props) {
  const b = message.body as ChatAnalyzeBody | null;
  if (!b) return null;
  const phase = card?.phase ?? { kind: 'pending' as const };
  if (phase.kind === 'done' || ['queued', 'reading', 'proposing', 'failed', 'cancelled', 'interrupted'].includes(phase.kind)) {
    return <div className="chat-card sup"><div className="chat-card-hd"><span className="chat-lb">{analyzeDone(b.name)}</span></div></div>;
  }
  const dead = phase.kind === 'superseded' || phase.kind === 'expired';
  const origin = reference?.origin ?? ('songId' in b.target ? 'library' : 'upload');
  const layers = layersNote(reference?.layers);
  const line = analyzeLine(phase);
  return (
    <div className={`chat-card${dead ? ' sup' : ''}`}>
      <div className="chat-card-hd"><span className="chat-lb">{ANALYZE_HEAD}</span><span className="chat-hn">{ANALYZE_TAIL}</span></div>
      <div className="chat-card-sum">
        <b className="chat-card-title">{b.name}</b>
        <span className="chat-hn">{analyzeMeta(b.seconds, origin)}</span>
        {b.cut && b.seconds && <span className="chat-card-style">{cutNote(b.seconds)}</span>}
        {layers && <span className="chat-card-style">{layers}</span>}
        <span className="chat-hn">{RIGHTS_LINE}</span>
      </div>
      {phase.kind === 'refused' && <ChatErrorLine title={`${READ} REFUSED`} body={`${phase.reason}. Nothing started.`} />}
      {dead ? (
        <div className="chat-card-cm"><span className="chat-cs">{line}</span></div>
      ) : (
        <div className="chat-card-cm">
          <span className="chat-cs">{phase.kind === 'starting' ? line : readConsequence(b.estimate.total === 0 ? 0 : null, ahead)}</span>
          <button type="button" className="acid chat-create" disabled={phase.kind === 'starting'} onClick={onRead}><span>{READ}</span></button>
        </div>
      )}
    </div>
  );
}
