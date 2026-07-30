import { useState } from 'react';
import { api } from './api';
import { useVoiceStore } from './voiceStore';
import { Dropzone } from './Dropzone';
import { AudioPreview } from './AudioPreview';
import { previewPlayback } from './previewPlayback';
import { readDuration } from './audioDuration';

/** Manage-voices surface: upload a new clip, rename or delete existing ones.
 * `onClose` is only passed when embedded inline (legacy callers); Settings > Voices
 * renders this standalone with no close affordance. */
export function VoiceUploadForm({ onClose }: { onClose?: () => void }) {
  const { voices, fetchVoices } = useVoiceStore();
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const upload = async (file: File) => {
    if (!name.trim()) return setError('name is required');
    setError('');
    setUploading(true);
    try {
      const duration = await readDuration(file);
      await api.uploadVoice(name.trim(), file, { duration });
      setName('');
      await fetchVoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    const voice = voices.find((v) => v.id === id);
    // Its audio is about to 404 — don't leave a deleted clip as the live preview.
    if (voice) previewPlayback.stopIfCurrent(`/audio/${voice.audio_file}`);
    await api.deleteVoice(id);
    await fetchVoices();
  };

  return (
    <div className="voice-upload-form">
      <div className="section-label">MANAGE VOICES</div>
      <input placeholder="Voice name" value={name} onChange={(e) => setName(e.target.value)} />
      <Dropzone accept="audio/*" disabled={uploading} onFile={upload}>
        {uploading ? 'uploading…' : 'drag a short vocal clip here or click to upload'}
      </Dropzone>
      {error && <div className="error">{error}</div>}
      <div className="voice-list">
        {voices.map((v) => (
          <div key={v.id} className="voice-list-row">
            <span className="voice-list-name">{v.name}</span>
            <AudioPreview src={`/audio/${v.audio_file}`} label={v.name} duration={v.duration ?? undefined} height={22} />
            <button onClick={() => remove(v.id)}><span>✕</span></button>
          </div>
        ))}
        {voices.length === 0 && <div className="empty">No saved voices yet.</div>}
      </div>
      {onClose && <button className="voice-manage-btn" onClick={onClose}><span>DONE</span></button>}
    </div>
  );
}
