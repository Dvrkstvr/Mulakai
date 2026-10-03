import { useState } from 'react';
import { useVoiceStore } from './voiceStore';
import { useObjectUrl } from './useObjectUrl';
import { AudioPreviewPopover } from './AudioPreviewPopover';
import { ReferenceAudioPicker } from './ReferenceAudioPicker';
import type { ReferenceTaskType } from './referenceInfluence';

/** The RECIPE card's VOICE row: the reference audio this take is conditioned on, as one line
 * with a preview; CHANGE opens the full picker in place. A reused song's missing voice opens it
 * by itself, since its warning lives there. `naReason` replaces it all for an engine without one. */
export function RecipeVoice({ taskType, naReason }: { taskType: ReferenceTaskType; naReason: string | null }) {
  const { voices, refMode, selectedVoiceId, uploadedRefFile, missingReferenceLabel } = useVoiceStore();
  const [open, setOpen] = useState(false);
  const uploadUrl = useObjectUrl(uploadedRefFile);

  if (naReason) {
    return (
      <div className="recipe-field">
        <div className="setting-head"><span className="section-label">VOICE</span><span className="val">N/A</span></div>
        <div className="hint">{naReason}</div>
      </div>
    );
  }

  const voice = refMode === 'voice' ? voices.find((v) => v.id === selectedVoiceId) : undefined;
  const upload = refMode === 'upload' ? uploadedRefFile : null;
  const summary = voice ? `${voice.name} · saved voice`
    : refMode === 'voice' && selectedVoiceId ? 'saved voice'
      : upload ? `${upload.name} · uploaded clip` : 'none';
  const shown = open || !!missingReferenceLabel;

  return (
    <div className="recipe-field">
      <span className="section-label">VOICE</span>
      <div className="recipe-voice">
        {voice && <AudioPreviewPopover src={`/audio/${voice.audio_file}`} label={voice.name} duration={voice.duration ?? undefined} />}
        {upload && uploadUrl && <AudioPreviewPopover src={uploadUrl} label={upload.name} />}
        <span className="recipe-voice-name">{summary}</span>
        {!missingReferenceLabel && (
          <button type="button" className="linkish" aria-expanded={shown} onClick={() => setOpen(!shown)}>
            {shown ? 'DONE' : 'CHANGE'}
          </button>
        )}
      </div>
      {shown && <ReferenceAudioPicker taskType={taskType} bare />}
    </div>
  );
}
