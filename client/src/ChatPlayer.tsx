/** The player above the composer (D-095, F-045): the song's active take on the existing `Player` and
 * `useSingleAudioPlayback`, with the version pill. Space plays unless a text field has focus. Position starts at
 * 0 on every open; no reading, no section strip in C0 (F-053). */
import { Player } from './Player';
import { useMainTransportGuard } from './previewPlayback';
import { useSingleAudioPlayback } from './useSingleAudioPlayback';
import { useSpaceTransport } from './useSpaceTransport';

interface Props {
  /** The base layer's active take (chatScreen.playerTake). */
  file: string;
  title: string;
  number: number | null;
  label: string | null;
}

export function ChatPlayer({ file, title, number, label }: Props) {
  const src = `/audio/${file}`;
  const engine = useSingleAudioPlayback(src);
  useSpaceTransport(engine);
  useMainTransportGuard(engine);
  return (
    <div className="chat-player">
      <Player engine={engine} downloadSrc={src} downloadName={`${title}.wav`} />
      {number !== null && <span className="chat-vp" aria-label="Active version"><span>v{number}{label ? ` · ${label}` : ''}</span></span>}
    </div>
  );
}
