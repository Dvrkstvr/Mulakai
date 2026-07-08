import { useEffect } from 'react';
import { CustomSelect } from './CustomSelect';
import { Slider } from './Slider';
import { useVoiceStore } from './voiceStore';

const AUDIO_INFLUENCE_INFO = 'How closely the generation follows the reference clip\'s actual sound (timbre, vocal tone, mixing) — higher pulls the result closer to the reference audio itself.';
const STYLE_INFLUENCE_INFO = 'How closely the generation follows the reference clip\'s genre/style character — higher pulls the result toward the reference\'s overall style rather than just your prompt.';

/**
 * Voice-library reference-audio selector, shared by CreateView and
 * AddLayerTrigger. Sky-accented per docs/design/DESIGN.md — this is a scope
 * choice ("which voice conditions this generation"), not a commit action.
 * Upload/rename/delete management lives in Settings > Voices, not here.
 */
export function VoicePicker() {
  const { voices, selectedVoiceId, audioInfluence, styleInfluence, fetchVoices, selectVoice, setAudioInfluence, setStyleInfluence } =
    useVoiceStore();

  useEffect(() => {
    fetchVoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = voices.find((v) => v.id === selectedVoiceId);
  const options = [{ label: 'NONE', value: '' }, ...voices.map((v) => ({ label: v.name, value: v.id }))];

  return (
    <div className="voice-picker">
      <div className="voice-picker-head">
        <CustomSelect label="VOICE" value={selectedVoiceId ?? ''} onChange={(v) => selectVoice(v || null)} options={options} />
      </div>
      {selected && (
        <>
          <Slider label="AUDIO INFLUENCE" value={Math.round(audioInfluence * 100)} min={0} max={100} step={5}
            color="var(--sky)" info={AUDIO_INFLUENCE_INFO} onChange={(v) => setAudioInfluence(v / 100)} />
          <Slider label="STYLE INFLUENCE" value={Math.round(styleInfluence * 100)} min={0} max={100} step={5}
            color="var(--sky)" info={STYLE_INFLUENCE_INFO} onChange={(v) => setStyleInfluence(v / 100)} />
          <div className="hint">
            will condition on voice "{selected.name}" — audio {Math.round(audioInfluence * 100)}% / style {Math.round(styleInfluence * 100)}%
          </div>
        </>
      )}
    </div>
  );
}
