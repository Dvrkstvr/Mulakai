/** The CHAT screen (F-043..F-045; chat-lyrics.html frame 3, chat-turn.html): the title row, the thread column
 * with the player above the composer, and the 360 px draft sidebar (38 px rail when collapsed). */
import { useEffect, useMemo, useState } from 'react';
import { api, type SongDetail } from './api';
import {
  DRAFT_SUBTITLE, DROP_DRAFT, FORM_LINK, KEEP, NEW_CHAT, NEW_CHAT_REFUSED, NEW_SONG, SIDEBAR_HEAD, SIDEBAR_RENDERING, VERSIONS,
  newChatConsequence, sidebarSongHead, songSubtitle,
} from './chatCopy';
import { filledCount, liveFields, useChatDraftStore } from './chatDraftStore';
import { assistantOffCause } from './chatEntry';
import { committing, fillingKeys, fmtLength, latestSong, playerTake, sidebarFoot, sidebarMode } from './chatScreen';
import { useChatStore } from './chatStore';
import { ChatComposer } from './ChatComposer';
import { ChatDraftFields } from './ChatDraftFields';
import { ChatPlayer } from './ChatPlayer';
import { ChatSidebar } from './ChatSidebar';
import { ChatThread } from './ChatThread';

/** The thread's song, read again whenever a card lands (a new take, a new title). */
function useChatSong(songId: string | null | undefined, cards: number): SongDetail | null {
  const [song, setSong] = useState<SongDetail | null>(null);
  useEffect(() => {
    let live = true;
    if (!songId) { setSong(null); return; }
    api.songDetail(songId).then((s) => { if (live) setSong(s); }).catch(() => { if (live) setSong(null); });
    return () => { live = false; };
  }, [songId, cards]);
  return song;
}

interface Props {
  /** FORM ▸: Guided Create (no draft carry-over until C6). */
  onForm: () => void;
  /** LIBRARY ▸ on a song card: the Library with that song's detail open. */
  onLibrary: (songId: string | null) => void;
}

export function ChatView({ onForm, onLibrary }: Props) {
  const chat = useChatStore();
  const { thread, turn, commit, status } = chat;
  const draft = useChatDraftStore((s) => s.draft);
  const pending = useChatDraftStore((s) => s.pending);
  const live = useMemo(() => liveFields({ draft, pending, filled: {}, assistantRev: {} }), [draft, pending]);
  const cards = thread?.messages.filter((m) => m.kind === 'song' || m.kind === 'version').length ?? 0;
  const song = useChatSong(thread?.songId, cards);
  const latest = latestSong(thread);
  const take = playerTake(song);
  const [confirmNew, setConfirmNew] = useState(false);
  const assistantOn = assistantOffCause(status) === null;
  const mode = sidebarMode(thread, commit);
  const title = thread?.songId ? song?.title ?? '' : NEW_SONG;
  const messages = thread?.messages.length ?? 0;

  const newChat = () => {
    if (thread?.songId || messages === 0) void chat.openDraft();
    else setConfirmNew(true);
  };

  return (
    <div className="chat-view">
      <div className="chat-title-row">
        <h2 className="chat-title">{title}</h2>
        <span className="chat-hn">{thread?.songId ? songSubtitle(latest?.number ?? null, fmtLength(song?.duration ?? latest?.seconds)) : DRAFT_SUBTITLE}</span>
        <span className="chat-title-gap" />
        <button type="button" className="chat-link" onClick={onForm}>{FORM_LINK}</button>
        {confirmNew ? (
          <span className="chat-confirm">
            <span className="chat-cs">{newChatConsequence(messages)}</span>
            <button type="button" className="chat-danger" onClick={() => { setConfirmNew(false); void chat.newChat(); }}><span>{DROP_DRAFT}</span></button>
            <button type="button" className="chat-q" onClick={() => setConfirmNew(false)}><span>{KEEP}</span></button>
          </span>
        ) : (
          <button type="button" className="chat-q" onClick={newChat}><span>{NEW_CHAT}</span></button>
        )}
      </div>
      {chat.refusal && <div className="chat-er chat-refusal" role="alert"><div><b>{NEW_CHAT_REFUSED}</b> {chat.refusal}</div></div>}
      <div className="chat-body">
        <div className="chat-main">
          <ChatThread songTitle={title} onForm={onForm} onLibrary={() => onLibrary(thread?.songId ?? null)} />
          {song && take && <ChatPlayer key={take} file={take} title={song.title} number={latest?.number ?? null} label={latest?.label ?? null} />}
          <ChatComposer turn={turn} assistantOn={assistantOn} committing={committing(thread, commit)} onType={chat.type} onSend={() => void chat.send()} />
        </div>
        <ChatSidebar
          head={mode === 'song' ? sidebarSongHead(title) : mode === 'locked' ? SIDEBAR_RENDERING : SIDEBAR_HEAD}
          foot={sidebarFoot(thread, commit, assistantOn)}
          filled={filledCount(live)}
          top={mode === 'song' && latest ? (
            <div className="chat-fd"><div className="chat-fk">{VERSIONS}</div><div><span className="chat-vp"><span>v{latest.number} ●</span></span></div></div>
          ) : null}
        >
          <ChatDraftFields filling={fillingKeys(live, turn)} locked={mode !== 'draft'} />
        </ChatSidebar>
      </div>
    </div>
  );
}
