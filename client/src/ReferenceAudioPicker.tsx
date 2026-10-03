import { CustomSelect } from './CustomSelect';
import { Slider } from './Slider';
import { useVoiceStore } from './voiceStore';
import { useLookup } from './lookup';
import { Dropzone } from './Dropzone';
import { AudioPreviewPopover } from './AudioPreviewPopover';
import { useObjectUrl } from './useObjectUrl';
import { type ReferenceTaskType, influenceHint, showsStyleInfluence } from './referenceInfluence';

interface Props {
  /** Decides whether STYLE INFLUENCE is live and what the hint promises — see referenceInfluence.ts. */
  taskType: ReferenceTaskType;
  /** Leaves out the REFERENCE AUDIO label, for a host row that already names it (the RECIPE's VOICE). */
  bare?: boolean;
}

const STYLE_INFLUENCE_INFO = 'How closely the generation follows the reference clip\'s genre/style character — higher pulls the result toward the reference\'s overall style rather than just your prompt.';

/**
 * Shared reference-audio control for all three START FROM flows, opened from the RECIPE card's
 * VOICE row so the choice persists across a card switch. Either a
 * saved voice profile or an ad-hoc uploaded clip — never both, since ACE-Step only accepts one
 * `reference_audio` per request; voiceStore.ts enforces that mutual exclusion at the store
 * level (shared with Add Layer's VoicePicker, which never sets uploadedRefFile itself).
 */
export function ReferenceAudioPicker({ taskType, bare }: Props) {
  const {
    voices, refMode, selectedVoiceId, uploadedRefFile, styleInfluence, missingReferenceLabel,
    fetchVoices, setRefMode, selectVoice, setUploadedRefFile, setStyleInfluence,
  } = useVoiceStore();

  // Only VOICE needs the list; NONE and UPLOAD stay usable when it fails to load.
  const voicesLookup = useLookup(fetchVoices);

  const selected = voices.find((v) => v.id === selectedVoiceId);
  const options = [{ label: 'NONE', value: '' }, ...voices.map((v) => ({ label: v.name, value: v.id }))];
  const uploadedRefUrl = useObjectUrl(uploadedRefFile);

  return (
    <div className="voice-picker">
      {!bare && <div className="section-label">REFERENCE AUDIO</div>}
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
          {voicesLookup.error && (
            <div className="error">couldn't load voices — {voicesLookup.error} <button onClick={voicesLookup.retry}>RETRY</button></div>
          )}
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
          {showsStyleInfluence(taskType) && (
            <Slider label="STYLE INFLUENCE" value={Math.round(styleInfluence * 100)} min={0} max={100} step={5}
              color="var(--sky)" info={STYLE_INFLUENCE_INFO} onChange={(v) => setStyleInfluence(v / 100)} />
          )}
          <div className="hint">
            {selected ? `will condition on voice "${selected.name}"` : 'will condition on the uploaded reference clip'}
            {influenceHint(taskType, styleInfluence)}
          </div>
        </>
      )}
    </div>
  );
}
