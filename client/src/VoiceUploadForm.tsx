import { useState } from 'react';
import { api } from './api';
import { useVoiceStore } from './voiceStore';
import { Dropzone } from './Dropzone';
import { previewPlayback } from './previewPlayback';
import { readDuration } from './audioDuration';
import { attempt } from './actionError';
import { useLookup } from './lookup';
import { VoiceList } from './VoiceList';

/** Manage-voices surface: upload a new clip, rename or delete existing ones.
 * `onClose` is only passed when embedded inline (legacy callers); Settings > Voices
 * renders this standalone with no close affordance. */
export function VoiceUploadForm({ onClose }: { onClose?: () => void }) {
  const { voices, fetchVoices } = useVoiceStore();
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  // Refreshed after an upload or delete too, so a failed refresh reads as the list failing.
  const list = useLookup(fetchVoices);

  const upload = async (file: File) => {
    if (!name.trim()) return setError('name is required');
    setError('');
    setUploading(true);
    try {
      const duration = await readDuration(file);
      await api.uploadVoice(name.trim(), file, { duration });
      setName('');
      list.retry();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const remove = (id: string) => {
    const voice = voices.find((v) => v.id === id);
    // Its audio is about to 404 — don't leave a deleted clip as the live preview.
    if (voice) previewPlayback.stopIfCurrent(`/audio/${voice.audio_file}`);
    void attempt("couldn't delete voice", () => api.deleteVoice(id), setError).then((ok) => { if (ok) list.retry(); });
  };

  return (
    <div className="voice-upload-form">
      <div className="section-label">MANAGE VOICES</div>
      <input placeholder="Voice name" value={name} onChange={(e) => setName(e.target.value)} />
      <Dropzone accept="audio/*" disabled={uploading} onFile={upload}>
        {uploading ? 'uploading…' : 'drag a short vocal clip here or click to upload'}
      </Dropzone>
      {error && <div className="error">{error}</div>}
      <VoiceList voices={voices} listError={list.error} onRetry={list.retry} onRemove={remove} />
      {onClose && <button className="voice-manage-btn" onClick={onClose}><span>DONE</span></button>}
    </div>
  );
}
