/** A sent message in the thread (F-041, chat-turn.html; split out of ChatThread for C1): its text, the ◉ reference it
 * carried (C3, F-061), the frozen mark echo (C1, F-055: `ChatMarkEcho`), then its turn line, CANCELLED or
 * INTERRUPTED. */
import type { ReactNode } from 'react';
import type { ChatMessageView, ChatUserBody } from './api/chat';
import type { ReferenceView } from './api/chatReferences';
import { useChatAnalysisStore } from './chatAnalysisStore';
import { CANCELLED_LINE, INTERRUPTED_LINE } from './chatCopy';
import { ChatMarkEcho } from './ChatMarkEcho';
import { versionNumber } from './chatMarkLabel';
import { sentAttach } from './chatReferenceCopy';
import { ChatErrorLine } from './ChatTurnLine';

interface Props {
  m: ChatMessageView;
  threadId: string;
  messages: ChatMessageView[];
  references: ReferenceView[] | undefined;
  /** The open turn's line, when this message is its turn's. */
  turnLine: ReactNode;
}

export function ChatUserMessage({ m, threadId, messages, references, turnLine }: Props) {
  const view = useChatAnalysisStore((s) => s.analysis.view);
  const body = m.body as ChatUserBody | null;
  const attach = body?.attach;
  const mark = body?.mark;
  return (
    <>
      <div className="chat-um">
        {m.text}
        {attach && <div className="chat-hn chat-um-attach">{sentAttach(references?.find((r) => r.id === attach.referenceId)?.name ?? 'a reference')}</div>}
        {mark && (
          <ChatMarkEcho
            threadId={threadId} mark={mark} view={view} sections={view?.shown?.sections ?? []}
            was={versionNumber(mark.versionId, messages, view)} now={view?.number ?? null}
          />
        )}
      </div>
      {turnLine ?? (m.state === 'cancelled' ? <div className="chat-hn">{CANCELLED_LINE}</div>
        : m.state === 'interrupted' ? <ChatErrorLine title="INTERRUPTED" body={INTERRUPTED_LINE} /> : null)}
    </>
  );
}
