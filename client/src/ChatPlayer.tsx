/** The player above the composer (D-095, F-045): the song's active take on the existing `Player`, with the version
 * pill. Space plays unless a text field has focus. Position starts at 0 on every open; no reading, no section strip in
 * C0 (F-053). C3 (F-062, RF-6): a song with a reference gets the REFERENCE ⇄ SONG pill; the swap keeps the seconds
 * and the play state (`useChatPlayback`). */
import { useEffect } from 'react';
import { abReference } from './chatAb';
import { AB_LISTENING, AB_PILL } from './chatReferenceCopy';
import { useChatStore } from './chatStore';
import { Player } from './Player';
import { useMainTransportGuard } from './previewPlayback';
import { useChatAb, useChatPlayback } from './useChatPlayback';
import { useSpaceTransport } from './useSpaceTransport';
import './chatReferenceSong.css';

interface Props {
  /** The base layer's active take (chatScreen.playerTake). */
  file: string;
  title: string;
  number: number | null;
  label: string | null;
}

export function ChatPlayer({ file, title, number, label }: Props) {
  const reference = useChatStore((s) => (s.thread?.songId ? abReference(s.thread.references) : null));
  const toggle = useChatAb((s) => s.toggle);
  const { engine, side, src } = useChatPlayback({ song: `/audio/${file}`, reference: reference?.url ?? null });
  useSpaceTransport(engine);
  useMainTransportGuard(engine);
  useEffect(() => () => useChatAb.getState().reset(), []); // a new take or another thread starts on the song
  const onRef = side === 'reference';
  return (
    <div className="chat-player">
      <Player engine={engine} downloadSrc={src} downloadName={onRef ? reference!.name : `${title}.wav`} />
      {number !== null && !onRef && <span className="chat-vp" aria-label="Active version"><span>v{number}{label ? ` · ${label}` : ''}</span></span>}
      {reference && (
        <button type="button" className={`chat-ab${onRef ? ' on' : ''}`} aria-pressed={onRef} onClick={toggle}><span>{AB_PILL}</span></button>
      )}
      {onRef && <span className="chat-hn chat-ab-status">{AB_LISTENING}</span>}
    </div>
  );
}
