/** The song card a saved take appends (F-045, TU-10): the version pill, title and label, length, and the way to
 * the song in the Library; a take cut at the length cap adds a rust TRUNCATED line (D-025). */
import type { ChatMessageView, ChatSongBody } from './api/chat';
import { LIBRARY_LINK, songCardMeta, truncatedLine } from './chatCopy';
import { fmtLength } from './chatScreen';

interface Props {
  message: ChatMessageView;
  title: string;
  onLibrary: () => void;
}

export function ChatSongCard({ message, title, onLibrary }: Props) {
  const body = message.body as ChatSongBody | null;
  const number = body?.number ?? 1;
  return (
    <div className="chat-card chat-song-card">
      <div className="chat-card-hd">
        <span className="chat-vp"><span>v{number}</span></span>
        <b className="chat-song-title">{title}{body?.label ? ` · ${body.label}` : ''}</b>
        <span className="chat-hn">{songCardMeta(fmtLength(body?.seconds))}</span>
        <button type="button" className="chat-link" onClick={onLibrary}>{LIBRARY_LINK}</button>
      </div>
      {body?.truncated && <div className="chat-song-truncated">{truncatedLine(fmtLength(body.seconds), number)}</div>}
    </div>
  );
}
