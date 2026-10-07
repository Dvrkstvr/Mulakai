/** The version card a saved chat edit appends (F-048, chat-edit.html 3a-3e; EC-5..EC-7): the lilac pill, the label (the
 * change list), the length and what changed (the bars, the whole song, TRUNCATED), a rust line when the result is not
 * what the card promised (an unaligned join, a short render; D-101), PLAY, and BACK TO vN, the same A/B pill as
 * REFERENCE ⇄ SONG (`useChatAb`). No A/B once the version before it is gone. */
import type { ChatMessageView } from './api/chat';
import type { ChatVersionBody } from './api/chatEdit';
import { PLAY, VERSION_LABEL, abOnLabel, backTo, versionFoot, versionHint, versionMeta, versionWarn } from './chatEditCopy';
import { ChatErrorLine } from './ChatTurnLine';
import './chatEdit.css';
import './chatReferenceSong.css';

interface Props {
  message: ChatMessageView;
  /** This version is the song's active take (PLAY plays it in the player). */
  active: boolean;
  /** This card is the player's A/B (the newest, active, with its previous version still there). */
  ab: boolean;
  /** The player is on the previous version. */
  onPrevious: boolean;
  onPlay: () => void;
  onBack: () => void;
}

export function ChatVersionCard({ message, active, ab, onPrevious, onPlay, onBack }: Props) {
  const v = message.body as ChatVersionBody | null;
  if (!v) return null;
  const warn = versionWarn(v);
  return (
    <div className="chat-card chat-version-card">
      <div className="chat-card-hd">
        <span className="chat-lb">{VERSION_LABEL}</span>
        <span className="chat-vp"><span>v{v.number}</span></span>
        <span className="chat-hn">{versionHint(v)}{active ? ' · ACTIVE NOW' : ''}</span>
      </div>
      <div className="chat-version-body">
        <b className="chat-card-title">{v.label}</b>
        <div className="chat-card-style chat-version-meta">{versionMeta(v)}</div>
        {warn && <ChatErrorLine title={warn.title} body={warn.body} />}
      </div>
      <div className="chat-card-cm">
        <span className="chat-cs">{versionFoot(v, active)}</span>
        {active && <button type="button" className="chat-q" onClick={onPlay}><span>{PLAY}</span></button>}
        {ab && v.previous && (
          <button type="button" className={`chat-ab${onPrevious ? ' on' : ''}`} aria-pressed={onPrevious} onClick={onBack}>
            <span>{onPrevious ? abOnLabel(v.previous.number, v.number) : backTo(v.previous.number)}</span>
          </button>
        )}
      </div>
    </div>
  );
}
