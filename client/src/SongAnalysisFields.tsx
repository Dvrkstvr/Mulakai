import { AutoTextarea } from './AutoTextarea';
import { SongDetailsFields } from './SongDetailsFields';

interface Props {
  analyzing: boolean;
  error: string;
  lyrics: string;
  onLyricsChange: (v: string) => void;
  bpm: number;
  onBpmChange: (v: number) => void;
  duration: number;
  onDurationChange: (v: number) => void;
  keyScale: string;
  onKeyScaleChange: (v: string) => void;
}

/** LYRICS + SONG DETAILS block for the AUDIO/ARRANGE Create tabs — identical shape in both,
 * so it's shared rather than duplicated. Sits below `AnalyzeAudioButton`; fills from
 * `useAnalyzeSourceAudio`'s result (see CreateAudioTab.tsx/CreateArrangeTab.tsx), but the
 * fields stay plain editable inputs the user can override before generating. A failed
 * analysis just re-clicks the same button, so its error is shown here without its own
 * retry control. */
export function SongAnalysisFields({
  analyzing, error, lyrics, onLyricsChange, bpm, onBpmChange, duration, onDurationChange, keyScale, onKeyScaleChange,
}: Props) {
  return (
    <>
      {analyzing && <span className="meta">analyzing source audio…</span>}
      {error && <div className="error">{error}</div>}

      <div className="section-label">LYRICS</div>
      <AutoTextarea className="lyrics-input" placeholder="[verse]&#10;Lyrics (optional)" value={lyrics} onChange={onLyricsChange} />

      <div className="section-label">SONG DETAILS</div>
      <div className="song-details-grid">
        <SongDetailsFields
          bpm={bpm} onBpmChange={onBpmChange}
          duration={duration} onDurationChange={onDurationChange}
          keyScale={keyScale} onKeyScaleChange={onKeyScaleChange}
        />
      </div>
    </>
  );
}
