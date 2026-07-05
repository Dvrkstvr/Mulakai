import { useState } from 'react';
import { api } from './api';
import { useVoiceStore } from './voiceStore';

/** Reads a browser-side audio duration without a server-side probing dependency. */
function readDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const el = document.createElement('audio');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(el.src);
      resolve(Number.isFinite(el.duration) ? el.duration : undefined);
    };
    el.onerror = () => resolve(undefined);
    el.src = URL.createObjectURL(file);
  });
}

/** Manage-voices surface: upload a new clip, rename or delete existing ones. */
export function VoiceUploadForm({ onClose }: { onClose: () => void }) {
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
    await api.deleteVoice(id);
    await fetchVoices();
  };

  return (
    <div className="voice-upload-form">
      <div className="section-label">MANAGE VOICES</div>
      <input placeholder="Voice name" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="dropzone">
        <input
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          disabled={uploading}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        {uploading ? 'uploading…' : 'click to upload a short vocal clip'}
      </label>
      {error && <div className="error">{error}</div>}
      <div className="voice-list">
        {voices.map((v) => (
          <div key={v.id} className="voice-list-row">
            <span>{v.name}</span>
            <button onClick={() => remove(v.id)}><span>✕</span></button>
          </div>
        ))}
        {voices.length === 0 && <div className="empty">No saved voices yet.</div>}
      </div>
      <button className="voice-manage-btn" onClick={onClose}><span>DONE</span></button>
    </div>
  );
}
