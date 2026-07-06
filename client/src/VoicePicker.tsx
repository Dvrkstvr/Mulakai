import { useEffect, useState } from 'react';
import { CustomSelect } from './CustomSelect';
import { Slider } from './Slider';
import { useVoiceStore } from './voiceStore';
import { VoiceUploadForm } from './VoiceUploadForm';

/**
 * Voice-library reference-audio selector, shared by CreateView and
 * AddLayerTrigger. Sky-accented per docs/design/DESIGN.md — this is a scope
 * choice ("which voice conditions this generation"), not a commit action.
 */
export function VoicePicker() {
  const { voices, selectedVoiceId, audioInfluence, styleInfluence, fetchVoices, selectVoice, setAudioInfluence, setStyleInfluence } =
    useVoiceStore();
  const [managing, setManaging] = useState(false);

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
        <button className="voice-manage-btn" onClick={() => setManaging(!managing)}>
          <span>{managing ? 'CLOSE' : 'MANAGE VOICES'}</span>
        </button>
      </div>
      {managing && <VoiceUploadForm onClose={() => setManaging(false)} />}
      {selected && (
        <>
          <Slider label="AUDIO INFLUENCE" value={Math.round(audioInfluence * 100)} min={0} max={100} step={5}
            color="var(--sky)" onChange={(v) => setAudioInfluence(v / 100)} />
          <Slider label="STYLE INFLUENCE" value={Math.round(styleInfluence * 100)} min={0} max={100} step={5}
            color="var(--sky)" onChange={(v) => setStyleInfluence(v / 100)} />
          <div className="hint">
            will condition on voice "{selected.name}" — audio {Math.round(audioInfluence * 100)}% / style {Math.round(styleInfluence * 100)}%
          </div>
        </>
      )}
    </div>
  );
}
