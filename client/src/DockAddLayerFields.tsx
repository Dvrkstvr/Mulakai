import { useEffect } from 'react';
import { useAddLayerDraft } from './addLayerStore';
import { AutoTextarea } from './AutoTextarea';
import { TRACK_NAMES } from './trackNames';
import { lyricsPrefill, sungTrack } from './addLayerCopy';
import { HelpBox } from './HelpBox';

interface Props {
  trackName: string;
  onTrackName: (trackName: string) => void;
  prompt: string;
  onPrompt: (prompt: string) => void;
  songLyrics: string;
}

/** ADD LAYER's TRACK chips (AUTO first), description, and — for a sung track only — lyrics, which start as the song's
 * when the field is empty (a field cleared on purpose stays clear until the track changes). */
export function DockAddLayerFields({ trackName, onTrackName, prompt, onPrompt, songLyrics }: Props) {
  const lyrics = useAddLayerDraft((s) => s.lyrics);
  const setLyrics = useAddLayerDraft((s) => s.setLyrics);
  useEffect(() => {
    const prefill = lyricsPrefill(trackName, useAddLayerDraft.getState().lyrics, songLyrics);
    if (prefill !== null) setLyrics(prefill);
    // Only on a track pick: re-running on every keystroke would refill a field the user cleared.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackName]);
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
      <div className="help-field">
        <input
          className="dock-prompt"
          placeholder="Describe what to add (e.g. punchy drums and a walking bassline)"
          value={prompt}
          onChange={(e) => onPrompt(e.target.value)}
        />
        <HelpBox kind="layer" layer={TRACK_NAMES.find((t) => t.value === trackName && t.value)?.label ?? ''} current={prompt} onUse={onPrompt} />
      </div>
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
