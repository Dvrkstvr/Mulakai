/** The player above the composer (D-095, F-045): the song's active take on the existing `Player` and
 * `useSingleAudioPlayback`, with the version pill. Space plays unless a text field has focus. Position starts at
 * 0 on every open; no reading, no section strip in C0 (F-053). */
import type { Song } from './api';
import { Player } from './Player';
import { useMainTransportGuard } from './previewPlayback';
import { useSingleAudioPlayback } from './useSingleAudioPlayback';
import { useSpaceTransport } from './useSpaceTransport';

interface Props {
  song: Song;
  number: number | null;
  label: string | null;
}

export function ChatPlayer({ song, number, label }: Props) {
  const src = song.audio_file ? `/audio/${song.audio_file}` : '';
  const engine = useSingleAudioPlayback(src);
  useSpaceTransport(engine);
  useMainTransportGuard(engine);
  return (
    <div className="chat-player">
      <Player engine={engine} downloadSrc={src} downloadName={`${song.title}.wav`} />
      {number !== null && <span className="chat-vp" aria-label="Active version"><span>v{number}{label ? ` · ${label}` : ''}</span></span>}
    </div>
  );
}
