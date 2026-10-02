import type { Voice } from './api';
import { AudioPreview } from './AudioPreview';

/** Settings > Voices' saved-voice rows. A failed list load shows its error and RETRY,
 * never "No saved voices yet." — that is only said once the server answered with none. */
export function VoiceList({ voices, listError, onRetry, onRemove }: {
  voices: Voice[];
  listError: string;
  onRetry: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="voice-list">
      {voices.map((v) => (
        <div key={v.id} className="voice-list-row">
          <span className="voice-list-name">{v.name}</span>
          <AudioPreview src={`/audio/${v.audio_file}`} label={v.name} duration={v.duration ?? undefined} height={22} />
          <button onClick={() => onRemove(v.id)}><span>✕</span></button>
        </div>
      ))}
      {listError
        ? <div className="error">couldn't load voices — {listError} <button onClick={onRetry}>RETRY</button></div>
        : voices.length === 0 && <div className="empty">No saved voices yet.</div>}
    </div>
  );
}
