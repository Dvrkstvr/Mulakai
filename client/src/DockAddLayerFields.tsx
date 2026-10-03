import { useAddLayerDraft } from './addLayerStore';
import { AutoTextarea } from './AutoTextarea';
import { TRACK_NAMES } from './trackNames';
import { sungTrack } from './addLayerCopy';

interface Props {
  trackName: string;
  onTrackName: (trackName: string) => void;
  prompt: string;
  onPrompt: (prompt: string) => void;
  songLyrics: string;
}

/** ADD LAYER's TRACK chips (AUTO first), description, and — for a sung track only — lyrics. */
export function DockAddLayerFields({ trackName, onTrackName, prompt, onPrompt, songLyrics }: Props) {
  const lyrics = useAddLayerDraft((s) => s.lyrics);
  const setLyrics = useAddLayerDraft((s) => s.setLyrics);
  return (
    <>
      <div className="dock-chips" role="radiogroup" aria-label="Track">
        <span className="dock-row-label">TRACK</span>
        {TRACK_NAMES.map((t) => (
          <button
            key={t.value || 'auto'}
            type="button"
            role="radio"
            aria-checked={t.value === trackName}
            className={`tab dock-chip${t.value === trackName ? ' active' : ''}`}
            onClick={() => onTrackName(t.value)}
          >
            <span>{t.label.toUpperCase()}</span>
          </button>
        ))}
      </div>
      <input
        className="dock-prompt"
        placeholder="Describe what to add (e.g. punchy drums and a walking bassline)"
        value={prompt}
        onChange={(e) => onPrompt(e.target.value)}
      />
      {sungTrack(trackName) && (
        <div className="setting">
          <div className="setting-head">
            <span>LYRICS</span>
            {songLyrics.trim() && <button className="linkish" onClick={() => setLyrics(songLyrics)}>USE SONG LYRICS</button>}
          </div>
          <AutoTextarea
            placeholder="Leave blank for an instrumental layer, or type/paste lyrics to sing"
            value={lyrics}
            onChange={setLyrics}
          />
        </div>
      )}
    </>
  );
}
