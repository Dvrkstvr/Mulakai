/** The thread (F-041, F-043, chat-turn.html): messages oldest first, newest by the composer; the turn line under
 * the message it belongs to; a recipe reply with its CHANGED line and its card; song cards. A failed reply of
 * the open turn is drawn by its turn line (with RETRY); older ones stay as plain rust lines. C3 (F-061): the column
 * is the drop target on the draft thread, a message that carried a reference keeps its ◉ mark, and the analyze
 * (READ) and reading cards. */
import { Fragment, useEffect, useMemo, useRef } from 'react';
import type { ChatAskBody, ChatDraftKey, ChatFailedBody, ChatMessageView, ChatReadingBody, ChatRecipeBody, ChatUserBody } from './api/chat';
import { chatApi } from './api/chat';
import { ChatAnalyzeCard } from './ChatAnalyzeCard';
import { ChatDropZone } from './ChatAttach';
import { ChatReadingCard } from './ChatReadingCard';
import type { CardState } from './chatReading';
import { sentAttach } from './chatReferenceCopy';
import { assistantOffCause } from './chatEntry';
import { ASK_AGAIN_TEXT, ASSISTANT_OFF, CANCELLED_LINE, EMPTY_THREAD, FIELD_LABEL, INTERRUPTED_LINE, OPEN_FAILED, changedLine, failedTitle, offBody, skippedLine, touchedSinceSend } from './chatCopy';
import { liveFields, skipsAtReply, useChatDraftStore } from './chatDraftStore';
import { cardView, latestSong } from './chatScreen';
import { useChatStore } from './chatStore';
import { lastTurn, turnRunning } from './chatTurn';
import { ChatRecipeCard } from './ChatRecipeCard';
import { ChatSongCard } from './ChatSongCard';
import { ChatErrorLine, ChatTurnLine, FormButton, RetryButton } from './ChatTurnLine';
import { api } from './api';
import { useJobsAhead } from './queueStore';

const KEYS = Object.keys(FIELD_LABEL) as ChatDraftKey[];

interface Props {
  songTitle: string;
  onForm: () => void;
  onLibrary: () => void;
}

export function ChatThread({ songTitle, onForm, onLibrary }: Props) {
  const chat = useChatStore();
  const { thread, turn, commit, status, error } = chat;
  const draft = useChatDraftStore((s) => s.draft);
  const pending = useChatDraftStore((s) => s.pending);
  const blockers = useChatDraftStore((s) => s.blockers);
  const live = useMemo(() => liveFields({ draft, pending, filled: {}, assistantRev: {} }), [draft, pending]);
  const ahead = useJobsAhead();
  const msgs = useMemo(() => thread?.messages ?? [], [thread]);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, turn.phase.kind, commit?.phase.kind]);

  const offCause = assistantOffCause(status);
  const failedReply = turn.phase.kind === 'failed' || turn.phase.kind === 'offline' ? lastTurn(msgs, turn.messageId)?.reply?.id : null;
  const sentRev = (msgs.find((m) => m.id === turn.messageId)?.body as ChatUserBody | null)?.sentRev;
  const touched = turnRunning(turn) && sentRev !== undefined
    ? touchedSinceSend(KEYS.filter((k) => k !== 'engine' && skipsAtReply({ draft, pending, filled: {}, assistantRev: {} }, k, sentRev))) : null;
  const done = latestSong(thread);
  const doneNumber = done?.number ?? null;
  const retry = async () => { await chat.loadStatus(); await chat.retry(); };
  const askAgain = () => { chat.type(ASK_AGAIN_TEXT); void chat.send(); };
  const refOf = (id: string | undefined) => thread?.references?.find((r) => r.id === id);
  /** A reading card's CANCEL: the reading job (the queue's), or the follow-up turn (the chat's). */
  const cancelCard = (c: CardState) => {
    if (!c.jobId) return;
    void (c.stage === 'followUp' ? chatApi.cancelChatJob(c.jobId) : api.cancelJob(c.jobId)).catch(() => undefined);
  };

  const item = (m: ChatMessageView) => {
    if (m.role === 'user') {
      return (
        <Fragment key={m.id}>
          <div className="chat-um">
            {m.text}
            {(m.body as ChatUserBody | null)?.attach && (
              <div className="chat-hn chat-um-attach">{sentAttach(refOf((m.body as ChatUserBody).attach?.referenceId)?.name ?? 'a reference')}</div>
            )}
          </div>
          {m.id === turn.messageId && turn.phase.kind !== 'sending'
            ? <ChatTurnLine turn={turn} touchedLine={touched} onCancel={() => void chat.cancel()} onRetry={() => void retry()} onForm={onForm} />
            : m.state === 'cancelled' ? <div className="chat-hn">{CANCELLED_LINE}</div>
              : m.state === 'interrupted' ? <ChatErrorLine title="INTERRUPTED" body={INTERRUPTED_LINE} /> : null}
        </Fragment>
      );
    }
    if (m.kind === 'failed') {
      const b = m.body as ChatFailedBody | null;
      // The open turn's failure is its turn line (with RETRY); a cancel reads CANCELLED under the message.
      if (m.id === failedReply || b?.cause === 'cancelled' || m.state === 'cancelled') return null;
      return b?.cause === 'offline'
        ? <ChatErrorLine key={m.id} title={ASSISTANT_OFF} body={offBody(b.reasons[0] ?? m.text)} />
        : <ChatErrorLine key={m.id} title={failedTitle(b?.cause ?? 'error')} body={(b?.reasons ?? [m.text]).join(' · ')} />;
    }
    if (m.kind === 'recipe') {
      const b = m.body as ChatRecipeBody | null;
      return (
        <Fragment key={m.id}>
          <div className="chat-am">
            {m.text}
            {b && changedLine(b.changed) && <div className="chat-hn chat-changed">{changedLine(b.changed)}</div>}
            {b && skippedLine(b.skipped) && <div className="chat-hn">{skippedLine(b.skipped)}</div>}
          </div>
          <ChatRecipeCard
            message={m} view={cardView(m, commit)} live={live} blockers={blockers} ahead={ahead} doneNumber={doneNumber} doneTruncated={Boolean(done?.truncated)}
            canAsk={!turnRunning(turn) && !offCause} onCreate={(id) => void chat.create(id)} onAskAgain={askAgain}
            onCancelQueued={() => commit?.jobId && void api.cancelJob(commit.jobId).catch(() => undefined)}
          />
        </Fragment>
      );
    }
    if (m.kind === 'song' || m.kind === 'version') {
      return (
        <Fragment key={m.id}>
          {m.text && <div className="chat-am">{m.text}</div>}
          <ChatSongCard message={m} title={songTitle} onLibrary={onLibrary} />
        </Fragment>
      );
    }
    if (m.kind === 'analyze') {
      const target = (m.body as { target?: { referenceId?: string } } | null)?.target;
      return (
        <Fragment key={m.id}>
          {m.text && <div className="chat-am">{m.text}</div>}
          <ChatAnalyzeCard
            message={m} card={chat.reading.cards[m.id]} reference={refOf(target?.referenceId)} ahead={ahead}
            onRead={() => m.proposalId && void chat.read(m.proposalId)}
          />
        </Fragment>
      );
    }
    if (m.kind === 'reading') {
      return (
        <ChatReadingCard
          key={m.id} message={m} card={chat.reading.cards[m.id]} reference={refOf((m.body as ChatReadingBody | null)?.referenceId)}
          onCancel={cancelCard} onReadAgain={(id) => void chat.reanalyze(id)}
        />
      );
    }
    const choices = m.kind === 'ask' ? (m.body as ChatAskBody | null)?.choices ?? [] : [];
    return (
      <div key={m.id} className="chat-am">
        {m.text}
        {choices.length > 0 && (
          <div className="chat-choices">
            {choices.map((c) => <button key={c} type="button" className="chat-q" onClick={() => chat.type(c)}><span>{c}</span></button>)}
          </div>
        )}
      </div>
    );
  };

  return (
    <ChatDropZone threadId={thread?.id ?? null} off={Boolean(thread?.songId)}>
      <div className="chat-thread" ref={scroller}>
        <div className="chat-thread-inner">
          {error && <ChatErrorLine title={OPEN_FAILED} body={error}><RetryButton onClick={() => void chat.openDraft()} /></ChatErrorLine>}
          {!error && msgs.length === 0 && turn.phase.kind !== 'sending' && <div className="chat-empty">{EMPTY_THREAD}</div>}
          {msgs.map(item)}
          {turn.phase.kind === 'sending' && (
            <>
              <div className="chat-um">{turn.lastText}</div>
              <ChatTurnLine turn={turn} onCancel={() => undefined} onRetry={() => undefined} onForm={onForm} />
            </>
          )}
          {offCause && turn.phase.kind !== 'offline' && (
            <ChatErrorLine title={ASSISTANT_OFF} body={offBody(offCause)}>
              <RetryButton onClick={() => void chat.loadStatus()} /><FormButton onClick={onForm} />
            </ChatErrorLine>
          )}
        </div>
      </div>
    </ChatDropZone>
  );
}
