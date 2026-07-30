import { useEffect } from 'react';
import { CustomSelect } from './CustomSelect';
import { Slider } from './Slider';
import { useVoiceStore } from './voiceStore';
import { Dropzone } from './Dropzone';
import { AudioPreviewPopover } from './AudioPreviewPopover';
import { useObjectUrl } from './useObjectUrl';

interface Props {
  /** Cover generation has its own VARIANCE-driven audio_cover_strength (see CreateAudioTab.tsx) —
   * the influence sliders here don't apply there, so the hint text is adjusted rather than
   * implying a control that has no effect. */
  taskType: 'text2music' | 'cover' | 'complete';
}

const AUDIO_INFLUENCE_INFO = 'How closely the generation follows the reference clip\'s actual sound (timbre, vocal tone, mixing) — higher pulls the result closer to the reference audio itself.';
const STYLE_INFLUENCE_INFO = 'How closely the generation follows the reference clip\'s genre/style character — higher pulls the result toward the reference\'s overall style rather than just your prompt.';

/**
 * Shared reference-audio control for all three Create tabs (PROMPT/AUDIO/ARRANGE), rendered
 * from the Generation Settings sidebar so the choice persists across tab switches. Either a
 * saved voice profile or an ad-hoc uploaded clip — never both, since ACE-Step only accepts one
 * `reference_audio` per request; voiceStore.ts enforces that mutual exclusion at the store
 * level (shared with Add Layer's VoicePicker, which never sets uploadedRefFile itself).
 */
export function ReferenceAudioPicker({ taskType }: Props) {
  const {
    voices, refMode, selectedVoiceId, uploadedRefFile, audioInfluence, styleInfluence, missingReferenceLabel,
    fetchVoices, setRefMode, selectVoice, setUploadedRefFile, setAudioInfluence, setStyleInfluence,
  } = useVoiceStore();

  useEffect(() => {
    fetchVoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = voices.find((v) => v.id === selectedVoiceId);
  const options = [{ label: 'NONE', value: '' }, ...voices.map((v) => ({ label: v.name, value: v.id }))];
  const uploadedRefUrl = useObjectUrl(uploadedRefFile);

  return (
    <div className="voice-picker">
      <div className="section-label">REFERENCE AUDIO</div>
      <div className="type-tabs">
        <button className={refMode === 'none' ? 'tab active' : 'tab'} onClick={() => setRefMode('none')}><span>NONE</span></button>
        <button className={refMode === 'voice' ? 'tab active' : 'tab'} onClick={() => setRefMode('voice')}><span>VOICE</span></button>
        <button className={refMode === 'upload' ? 'tab active' : 'tab'} onClick={() => setRefMode('upload')}><span>UPLOAD</span></button>
      </div>
      {missingReferenceLabel && (
        <div className="warn-note">
          Reused song was conditioned on &ldquo;{missingReferenceLabel}&rdquo; — not a saved voice
          (a one-off clip, or removed since). Pick a reference to condition on.
        </div>
      )}
      {refMode === 'voice' && (
        <>
          <div className="voice-picker-head">
            <CustomSelect label="VOICE" value={selectedVoiceId ?? ''} onChange={(v) => selectVoice(v || null)} options={options} />
            {selected && (
              <AudioPreviewPopover
                src={`/audio/${selected.audio_file}`}
                label={selected.name}
                duration={selected.duration ?? undefined}
              />
            )}
          </div>
          <div className="hint">manage saved voices in Settings &gt; Voices</div>
        </>
      )}
      {refMode === 'upload' && (
        <>
          <Dropzone accept="audio/*" onFile={setUploadedRefFile}>
            {uploadedRefFile ? uploadedRefFile.name : 'drag a clip here or click to steer timbre/mixing style'}
          </Dropzone>
          {uploadedRefFile && uploadedRefUrl && (
            <div className="upload-preview-row">
              <AudioPreviewPopover src={uploadedRefUrl} label={uploadedRefFile.name} />
              <span className="hint" style={{ margin: 0 }}>preview the dropped clip</span>
            </div>
          )}
        </>
      )}
      {(selected || uploadedRefFile) && (
        <>
          <Slider label="AUDIO INFLUENCE" value={Math.round(audioInfluence * 100)} min={0} max={100} step={5}
            color="var(--sky)" info={AUDIO_INFLUENCE_INFO} onChange={(v) => setAudioInfluence(v / 100)} />
          <Slider label="STYLE INFLUENCE" value={Math.round(styleInfluence * 100)} min={0} max={100} step={5}
            color="var(--sky)" info={STYLE_INFLUENCE_INFO} onChange={(v) => setStyleInfluence(v / 100)} />
          <div className="hint">
            {selected ? `will condition on voice "${selected.name}"` : 'will condition on the uploaded reference clip'}
            {taskType === 'cover'
              ? ' — the sliders above don\'t apply here; VARIANCE controls closeness to the source track instead'
              : ` — audio ${Math.round(audioInfluence * 100)}% / style ${Math.round(styleInfluence * 100)}%`}
          </div>
        </>
      )}
    </div>
  );
}
