/** The thread (F-041, F-043, chat-turn.html): messages oldest first, newest by the composer; the turn line under
 * the message it belongs to; a recipe reply with its CHANGED line and its card; song cards. A failed reply of
 * the open turn is drawn by its turn line (with RETRY); older ones stay as plain rust lines. C3 (F-061): the column
 * is the drop target on the draft thread, a message that carried a reference keeps its ◉ mark, and the analyze
 * (READ) and reading cards. C0b (CB-5): the edit card (APPLY) and the version card (PLAY, BACK TO vN). C1 (F-055): a
 * sent message's frozen mark echo (`ChatUserMessage`), and the stale-mark card last (`ChatMarkStale`). */
import { Fragment, useEffect, useMemo, useRef } from 'react';
import type { ChatAskBody, ChatDraftKey, ChatFailedBody, ChatMessageView, ChatReadingBody, ChatRecipeBody, ChatUserBody } from './api/chat';
import { chatApi } from './api/chat';
import { ChatAnalyzeCard } from './ChatAnalyzeCard';
import { useChatAnalysisStore } from './chatAnalysisStore';
import { ChatMarkStale } from './ChatMarkChip';
import { versionNumber } from './chatMarkLabel';
import { markToSend, useChatMarkStore } from './chatMarkStore';
import { ChatUserMessage } from './ChatUserMessage';
import { ChatDropZone } from './ChatAttach';
import { ChatEditCard } from './ChatEditCard';
import { askAgainText } from './chatEditView';
import { ChatVersionCard } from './ChatVersionCard';
import { ChatReadingCard } from './ChatReadingCard';
import type { CardState } from './chatReading';
import { assistantOffCause } from './chatEntry';
import { ASK_AGAIN_TEXT, ASSISTANT_OFF, EMPTY_THREAD, FIELD_LABEL, OPEN_FAILED, changedLine, failedTitle, offBody, skippedLine, touchedSinceSend } from './chatCopy';
import { liveFields, skipsAtReply, useChatDraftStore } from './chatDraftStore';
import { cardView, madeBy } from './chatScreen';
import { useChatStore } from './chatStore';
import { lastTurn, turnRunning } from './chatTurn';
import { ChatRecipeCard } from './ChatRecipeCard';
import { ChatSongCard } from './ChatSongCard';
import { ChatUndoLine } from './ChatUndoLine';
import { ChatRetimeUndo } from './ChatRetimeUndo';
import { ChatErrorLine, ChatTurnLine, FormButton, RetryButton } from './ChatTurnLine';
import { api } from './api';
import { useJobsAhead } from './queueStore';
import { useChatAb } from './useChatPlayback';

const KEYS = Object.keys(FIELD_LABEL) as ChatDraftKey[];

interface Props {
  songTitle: string;
  onForm: () => void;
  onLibrary: () => void;
  /** The song's active version (vN, its id) and the number APPLY saves; `abCardId` = the version card the player A/Bs. */
  versions?: { active: number | null; activeId: string | null; next: number };
  abCardId?: string | null;
}

export function ChatThread({ songTitle, onForm, onLibrary, versions, abCardId = null }: Props) {
  const chat = useChatStore();
  const { thread, turn, commit, status, error } = chat;
  const draft = useChatDraftStore((s) => s.draft);
  const pending = useChatDraftStore((s) => s.pending);
  const blockers = useChatDraftStore((s) => s.blockers);
  const live = useMemo(() => liveFields({ draft, pending, filled: {}, assistantRev: {} }), [draft, pending]);
  const ahead = useJobsAhead();
  const msgs = useMemo(() => thread?.messages ?? [], [thread]);
  const scroller = useRef<HTMLDivElement>(null);
  const staleMark = useChatMarkStore((s) => (thread ? s.byThread[thread.id]?.stale && s.byThread[thread.id].mark : null));
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, turn.phase.kind, commit?.phase.kind, staleMark]);

  const offCause = assistantOffCause(status);
  const failedReply = turn.phase.kind === 'failed' || turn.phase.kind === 'offline' ? lastTurn(msgs, turn.messageId)?.reply?.id : null;
  const sentRev = (msgs.find((m) => m.id === turn.messageId)?.body as ChatUserBody | null)?.sentRev;
  const touched = turnRunning(turn) && sentRev !== undefined
    ? touchedSinceSend(KEYS.filter((k) => k !== 'engine' && skipsAtReply({ draft, pending, filled: {}, assistantRev: {} }, k, sentRev))) : null;
  const retry = async () => { await chat.loadStatus(); await chat.retry(); };
  const view = useChatAnalysisStore((s) => s.analysis.view);
  const askAgain = (text: string | null = ASK_AGAIN_TEXT) => { chat.type(text ?? ASK_AGAIN_TEXT); void chat.send(markToSend(thread?.id, view?.shown?.sections ?? [])); };
  const abSide = useChatAb((s) => s.side);
  const refOf = (id: string | undefined) => thread?.references?.find((r) => r.id === id);
  /** A reading card's CANCEL, the reading or its follow-up turn: always the chat's route (it stops a running
   * reading between steps and frees the thread); the queue-only /api/generate cancel does neither. */
  const cancelCard = (c: CardState) => {
    if (c.jobId) void chatApi.cancelChatJob(c.jobId).catch(() => undefined);
  };

  const item = (m: ChatMessageView) => {
    if (m.role === 'user') {
      const line = m.id === turn.messageId && turn.phase.kind !== 'sending'
        ? <ChatTurnLine turn={turn} touchedLine={touched} onCancel={() => void chat.cancel()} onRetry={() => void retry()} onForm={onForm} /> : null;
      return <ChatUserMessage key={m.id} m={m} threadId={thread!.id} messages={msgs} references={thread?.references} turnLine={line} />;
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
      const done = madeBy(msgs, m);
      return (
        <Fragment key={m.id}>
          <div className="chat-am">
            {m.text}
            {b && <ChatUndoLine message={m} changed={changedLine(b.changed)} songId={thread?.songId ?? (done ? m.id : null)} turnOpen={turnRunning(turn)} />}
            {b && skippedLine(b.skipped) && <div className="chat-hn">{skippedLine(b.skipped)}</div>}
          </div>
          <ChatRecipeCard
            message={m} view={cardView(m, commit)} live={live} blockers={blockers} ahead={ahead} doneNumber={done?.number ?? null} doneTruncated={Boolean(done?.truncated)}
            canAsk={!turnRunning(turn) && !offCause} onCreate={(id) => void chat.create(id)} onAskAgain={() => askAgain()}
            onCancelQueued={() => commit?.jobId && void api.cancelJob(commit.jobId).catch(() => undefined)}
          />
        </Fragment>
      );
    }
    if (m.kind === 'edit') {
      return (
        <Fragment key={m.id}>
          {m.text && <div className="chat-am">{m.text}</div>}
          <ChatEditCard
            message={m} view={cardView(m, commit)} base={versions?.active ?? 1} next={versions?.next ?? 2} ahead={ahead}
            canAsk={!turnRunning(turn) && !offCause} onApply={(id) => void chat.apply(id)} onCancel={() => void chat.cancelApply()}
            onAskAgain={() => askAgain(askAgainText(msgs, m.id))}
          />
        </Fragment>
      );
    }
    if (m.kind === 'version') {
      return (
        <ChatVersionCard
          key={m.id} message={m} active={!!m.versionId && m.versionId === versions?.activeId} ab={m.id === abCardId}
          onPrevious={m.id === abCardId && abSide === 'previous'} onPlay={() => useChatAb.getState().playSong()}
          onBack={() => useChatAb.getState().toggle('previous')}
        />
      );
    }
    if (m.kind === 'song') {
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
        {m.kind === 'say' && <ChatRetimeUndo message={m} view={view} turnOpen={turnRunning(turn)} />}
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
          {staleMark && thread && (
            <ChatMarkStale threadId={thread.id} view={view} was={versionNumber(staleMark.versionId, msgs, view)} now={view?.number ?? null} />
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
