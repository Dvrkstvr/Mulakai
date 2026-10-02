import type { Song, Voice } from './api';
import { AudioPreview } from './AudioPreview';

/** "<name>" plus whichever influence percentages were recorded: style only for text2music
 * (ACE-Step neutralizes audio there), both for older songs, label alone for cover/complete. */
const referenceAudioValue = (song: Song): string => {
  const label = song.reference_audio_label ?? '';
  const parts = [
    song.reference_audio_influence != null ? `audio ${Math.round(song.reference_audio_influence * 100)}%` : null,
    song.reference_style_influence != null ? `style ${Math.round(song.reference_style_influence * 100)}%` : null,
  ].filter(Boolean);
  return parts.length ? `${label} — ${parts.join(' / ')}` : label;
};

/** The song detail rail's REFERENCE AUDIO row. The label comes from the song; the preview
 * needs the saved voice it names, so a failed voice list shows its error under the row. */
export function ReferenceAudioMeta({ song, voice, voicesError, onRetry }: {
  song: Song;
  voice: Voice | null;
  voicesError: string;
  onRetry: () => void;
}) {
  return (
    <>
      <div className="detail-meta-row">
        <span className="section-label">REFERENCE AUDIO</span>
        <span>{referenceAudioValue(song)}</span>
      </div>
      {voicesError && <div className="error">{voicesError} <button onClick={onRetry}>RETRY</button></div>}
      {voice && (
        <div className="rail-preview">
          <AudioPreview src={`/audio/${voice.audio_file}`} label={voice.name} duration={voice.duration ?? undefined} height={26} />
        </div>
      )}
    </>
  );
}
