/** The recipe card (F-044, chat-turn.html TU-6, TU-7): the summary of the live draft while pending, the
 * consequence line, and CREATE SONG, the card's only commit (acid; its label never turns into progress).
 * Superseded dims with no button, expired offers ASK AGAIN, done folds to one line; the take's line runs
 * under the card. C3 (chat-reference.html 3a, 3b): a cover is the same card with CREATE COVER and the rights line;
 * a borrow keeps CREATE SONG, says what it borrowed, and a value the reading lacked as AUTO with a rust line. */
import { useState } from 'react';
import type { ChatDraftFields, ChatDraftKey, ChatMessageView, ChatReadingBody, ChatRecipeBody } from './api/chat';
import { isNotRead } from './api/chatReferences';
import {
  ASK_AGAIN, COMMITTING_HINT, CREATE_FAILED, CREATE_SONG, EXPIRED_BODY, EXPIRED_TITLE, LYRICS_TOGGLE, RECIPE_HEADER, RECIPE_HINT,
  SUPERSEDED_BODY, YOUR_EDIT, blockersLine, cardHeader, createFailedLine, createJobLine, doneLine, recipeConsequence, recipeSummary,
} from './chatCopy';
import { sectionsToText, structureText } from './chatLyricsText';
import {
  BORROW_HINT, COVER_HEADER, COVER_HINT, CREATE_COVER, MISSING_BODY, RIGHTS_LINE, autoValue, borrowConsequence, coverConsequence,
  missingTitle,
} from './chatReferenceCopy';
import { editedSinceProposal, takeCancellable, type CardView } from './chatScreen';
import { useChatStore } from './chatStore';
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
  /** The song card says the take was cut at the length cap (D-025). */
  doneTruncated?: boolean;
  /** Another turn is open: ASK AGAIN waits for it. */
  canAsk: boolean;
  onCreate: (proposalId: string) => void;
  onAskAgain: () => void;
  onCancelQueued: () => void;
}

const blank = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/** Whose score a cover sings: a YuE2 library song's own, else the transcription (the thread's reading card). */
function useScoreSource(referenceId: string | undefined): 'own' | 'transcribed' {
  return useChatStore((s) => {
    const card = s.thread?.messages.filter((m) => m.kind === 'reading' && (m.body as ChatReadingBody | null)?.referenceId === referenceId).pop();
    const score = (card?.body as ChatReadingBody | null)?.reading?.score;
    return score && !isNotRead(score) ? score.source : 'transcribed';
  });
}

export function ChatRecipeCard({ message, view, live, blockers, ahead, doneNumber, doneTruncated, canAsk, onCreate, onAskAgain, onCancelQueued }: Props) {
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const body = message.body as ChatRecipeBody | null;
  const ref = body?.reference;
  const scoreSource = useScoreSource(ref?.referenceId);
  if (!body) return null;
  const cover = ref?.use === 'cover';
  const mirrors = view.kind === 'pending' || view.kind === 'committing';
  const f: ChatDraftFields = mirrors && live ? live : { ...body.recipe, engine: 'yue2' };
  const edited = mirrors && live ? editedSinceProposal(body.recipe, live) : [];
  const create = () => message.proposalId && onCreate(message.proposalId);
  const header = (h: string) => (cover ? h.replace(RECIPE_HEADER, COVER_HEADER) : h);
  const missing = (ref?.missing ?? []).filter((k: ChatDraftKey) => blank(f[k]));
  const summary = missing.includes('key') ? recipeSummary(f).replace(/^(\d+ BPM · )?/, (m) => `${m}${autoValue('key')} · `) : recipeSummary(f);

  if (view.kind === 'done') {
    return (
      <div className="chat-card">
        <div className="chat-card-hd"><span className="chat-lb">{header(cardHeader('done', f.title))}</span><span className={doneTruncated ? 'chat-hn truncated' : 'chat-hn'}>{doneLine(doneNumber, doneTruncated)}</span></div>
      </div>
    );
  }
  const phase = view.kind === 'committing' ? view.phase : null;
  const line = view.kind === 'committing' ? createJobLine(phase) : null;
  const blocked = cover ? blockersLine(blockers)?.replace(CREATE_SONG, CREATE_COVER) ?? null : blockersLine(blockers);
  const consequence = cover ? coverConsequence(body.estSeconds, scoreSource)
    : ref ? borrowConsequence(body.estSeconds, ref.borrowed, ahead) : recipeConsequence(body.estSeconds, ahead);
  const hint = view.kind === 'committing' ? COMMITTING_HINT : !mirrors ? '' : cover ? COVER_HINT : ref ? BORROW_HINT : RECIPE_HINT;
  return (
    <>
      <div className={`chat-card${view.kind === 'superseded' ? ' sup' : ''}`} aria-label="Proposal">
        <div className="chat-card-hd">
          <span className="chat-lb">{header(cardHeader(view.kind))}</span>
          <span className="chat-hn">{hint}</span>
        </div>
        <div className="chat-card-sum">
          <b className="chat-card-title">{f.title || '—'}</b>
          {f.style && <div className="chat-card-style">{f.style}</div>}
          <div className="chat-hn">
            {edited.includes('bpm') && body.recipe.bpm !== null && <><s>{body.recipe.bpm}</s>{' '}</>}
            {summary}
            {edited.length > 0 && <em className="chat-tag yours">{YOUR_EDIT}</em>}
          </div>
          {f.structure.length > 0 && <div className="chat-hn">{structureText(f.structure)}</div>}
          {f.lyrics.length > 0 && (
            <button type="button" className="chat-link" aria-expanded={lyricsOpen} onClick={() => setLyricsOpen(!lyricsOpen)}>
              {LYRICS_TOGGLE} {lyricsOpen ? '▾' : '▸'}
            </button>
          )}
          {lyricsOpen && <pre className="chat-ly">{sectionsToText(f.lyrics)}</pre>}
          {cover && <div className="chat-hn">{RIGHTS_LINE}</div>}
        </div>
        {mirrors && missing.map((k) => (
          <div key={k} className="chat-er chat-ref-warn"><div><b>{missingTitle(k)}</b> {MISSING_BODY}</div></div>
        ))}
        {mirrors && ref?.note && <div className="chat-er chat-ref-warn"><div>{ref.note}</div></div>}
        {view.kind === 'superseded' && <div className="chat-card-cm"><span className="chat-cs">{SUPERSEDED_BODY}</span></div>}
        {view.kind === 'expired' && (
          <ChatErrorLine title={EXPIRED_TITLE} body={EXPIRED_BODY}>
            <button type="button" className="chat-ao" disabled={!canAsk} onClick={onAskAgain}><span>{ASK_AGAIN}</span></button>
          </ChatErrorLine>
        )}
        {mirrors && (
          <div className="chat-card-cm">
            <span className="chat-cs">{blocked ?? consequence}</span>
            <button type="button" className="acid chat-create" disabled={!!blocked || view.kind === 'committing'} onClick={create}>
              <span>{cover ? CREATE_COVER : CREATE_SONG}</span>
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
