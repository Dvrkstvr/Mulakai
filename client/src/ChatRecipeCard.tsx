/** The recipe card (F-044, chat-turn.html TU-6, TU-7): the summary of the live draft while pending, the
 * consequence line, and CREATE SONG, the card's only commit (acid; its label never turns into progress).
 * Superseded dims with no button, expired offers ASK AGAIN, done folds to one line; the take's line runs
 * under the card. */
import { useState } from 'react';
import type { ChatDraftFields, ChatMessageView, ChatRecipeBody } from './api/chat';
import {
  ASK_AGAIN, COMMITTING_HINT, CREATE_FAILED, CREATE_SONG, EXPIRED_BODY, EXPIRED_TITLE, LYRICS_TOGGLE, RECIPE_HINT,
  SUPERSEDED_BODY, YOUR_EDIT, blockersLine, cardHeader, createFailedLine, createJobLine, doneLine, recipeConsequence, recipeSummary,
} from './chatCopy';
import { sectionsToText, structureText } from './chatLyricsText';
import { editedSinceProposal, takeCancellable, type CardView } from './chatScreen';
import { ChatErrorLine, ChatJobLine, RetryButton } from './ChatTurnLine';

interface Props {
  message: ChatMessageView;
  view: CardView;
  /** The live draft (sidebar), which a pending card mirrors and CREATE SONG sends. */
  live: ChatDraftFields | null;
  blockers: string[];
  /** Jobs ahead in the GPU queue: a busy GPU never disables CREATE SONG, it queues (fragment e). */
  ahead: number;
  doneNumber: number | null;
  /** Another turn is open: ASK AGAIN waits for it. */
  canAsk: boolean;
  onCreate: (proposalId: string) => void;
  onAskAgain: () => void;
  onCancelQueued: () => void;
}

export function ChatRecipeCard({ message, view, live, blockers, ahead, doneNumber, canAsk, onCreate, onAskAgain, onCancelQueued }: Props) {
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const body = message.body as ChatRecipeBody | null;
  if (!body) return null;
  const mirrors = view.kind === 'pending' || view.kind === 'committing';
  const f: ChatDraftFields = mirrors && live ? live : { ...body.recipe, engine: 'yue2' };
  const edited = mirrors && live ? editedSinceProposal(body.recipe, live) : [];
  const create = () => message.proposalId && onCreate(message.proposalId);

  if (view.kind === 'done') {
    return (
      <div className="chat-card">
        <div className="chat-card-hd"><span className="chat-lb">{cardHeader('done', f.title)}</span><span className="chat-hn">{doneLine(doneNumber)}</span></div>
      </div>
    );
  }
  const phase = view.kind === 'committing' ? view.phase : null;
  const line = view.kind === 'committing' ? createJobLine(phase) : null;
  const blocked = blockersLine(blockers);
  return (
    <>
      <div className={`chat-card${view.kind === 'superseded' ? ' sup' : ''}`} aria-label="Proposal">
        <div className="chat-card-hd">
          <span className="chat-lb">{cardHeader(view.kind)}</span>
          <span className="chat-hn">{view.kind === 'committing' ? COMMITTING_HINT : mirrors ? RECIPE_HINT : ''}</span>
        </div>
        <div className="chat-card-sum">
          <b className="chat-card-title">{f.title || '—'}</b>
          {f.style && <div className="chat-card-style">{f.style}</div>}
          <div className="chat-hn">
            {edited.includes('bpm') && body.recipe.bpm !== null && <><s>{body.recipe.bpm}</s>{' '}</>}
            {recipeSummary(f)}
            {edited.length > 0 && <em className="chat-tag yours">{YOUR_EDIT}</em>}
          </div>
          {f.structure.length > 0 && <div className="chat-hn">{structureText(f.structure)}</div>}
          {f.lyrics.length > 0 && (
            <button type="button" className="chat-link" aria-expanded={lyricsOpen} onClick={() => setLyricsOpen(!lyricsOpen)}>
              {LYRICS_TOGGLE} {lyricsOpen ? '▾' : '▸'}
            </button>
          )}
          {lyricsOpen && <pre className="chat-ly">{sectionsToText(f.lyrics)}</pre>}
        </div>
        {view.kind === 'superseded' && <div className="chat-card-cm"><span className="chat-cs">{SUPERSEDED_BODY}</span></div>}
        {view.kind === 'expired' && (
          <ChatErrorLine title={EXPIRED_TITLE} body={EXPIRED_BODY}>
            <button type="button" className="chat-ao" disabled={!canAsk} onClick={onAskAgain}><span>{ASK_AGAIN}</span></button>
          </ChatErrorLine>
        )}
        {mirrors && (
          <div className="chat-card-cm">
            <span className="chat-cs">{blocked ?? recipeConsequence(body.estSeconds, ahead)}</span>
            <button type="button" className="acid chat-create" disabled={!!blocked || view.kind === 'committing'} onClick={create}>
              <span>{CREATE_SONG}</span>
            </button>
          </div>
        )}
        {view.kind === 'pending' && view.error && (
          <ChatErrorLine title={CREATE_FAILED} body={createFailedLine(view.error)}><RetryButton onClick={create} /></ChatErrorLine>
        )}
      </div>
      {line && (
        <ChatJobLine
          title={line}
          working={phase?.kind === 'running'}
          waiting={phase?.kind !== 'running'}
          action={takeCancellable(phase)
            ? <button type="button" className="chat-q" onClick={onCancelQueued}><span>CANCEL</span></button> : undefined}
        />
      )}
    </>
  );
}
