import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type SongDetail } from './api';
import { Waveform, type Region } from './Waveform';

interface Props {
  songId: string;
  onBack: () => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function Editor({ songId, onBack }: Props) {
  const [song, setSong] = useState<SongDetail | null>(null);
  const [selection, setSelection] = useState<Region | null>(null);
  const [prompt, setPrompt] = useState('');
  const [strength, setStrength] = useState(0.5);
  const [job, setJob] = useState<'idle' | 'running'>('idle');
  const [error, setError] = useState('');
  const [playhead, setPlayhead] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const reload = useCallback(() => api.songDetail(songId).then(setSong).catch(() => {}), [songId]);
  useEffect(() => { reload(); }, [reload]);

  const baseLayer = song?.layers.find((l) => l.kind === 'base');
  const activeVersion = baseLayer?.versions.find((v) => v.active);
  const duration = song?.duration ?? 0;

  const repaint = async () => {
    if (!baseLayer || !selection) return;
    setError('');
    setJob('running');
    try {
      const { jobId } = await api.repaint(baseLayer.id, {
        prompt,
        start: selection.start,
        end: selection.end,
        repaint_strength: strength,
      });
      for (;;) {
        await new Promise((r) => setTimeout(r, 2000));
        const s = await api.jobStatus(jobId);
        if (s.status === 'done') break;
        if (s.status === 'failed') throw new Error(s.error ?? 'repaint failed');
      }
      setSelection(null);
      setPrompt('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setJob('idle');
    }
  };

  const revert = async (versionId: string) => {
    await api.activateVersion(versionId);
    await reload();
  };

  if (!song) return <div className="empty">Loading…</div>;

  return (
    <div>
      <header>
        <button onClick={onBack}>← LIBRARY</button>
        <span className="song-title" style={{ fontSize: 16, letterSpacing: 1 }}>{song.title}</span>
        <span className="meta">
          {duration ? fmt(duration) : ''}{song.bpm ? ` · ${song.bpm} bpm` : ''}{song.key_scale ? ` · ${song.key_scale}` : ''}
        </span>
      </header>

      {activeVersion && (
        <section className="canvas">
          <Waveform
            audioUrl={`/audio/${activeVersion.audio_file}`}
            duration={duration}
            selection={selection}
            onSelect={setSelection}
            playhead={playhead}
          />
          <div className="canvas-meta">
            <span>0:00</span>
            <span className="scope">
              {selection ? `selection ${fmt(selection.start)} – ${fmt(selection.end)}` : 'drag to select a region'}
            </span>
            <span>{fmt(duration)}</span>
          </div>
          <audio
            ref={audioRef}
            controls
            src={`/audio/${activeVersion.audio_file}`}
            onTimeUpdate={(e) => setPlayhead(e.currentTarget.currentTime)}
            style={{ width: '100%', marginTop: 8 }}
          />
        </section>
      )}

      <section className="repaint">
        <div className="scope-chip">
          {selection ? `${fmt(selection.start)}–${fmt(selection.end)} · BASE` : 'NO SELECTION'}
        </div>
        <input
          placeholder="Describe what should change in the selected region"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <label className="slider">
          VARIANCE {Math.round(strength * 100)}
          <input type="range" min="0" max="1" step="0.05" value={strength}
            onChange={(e) => setStrength(Number(e.target.value))} />
        </label>
        <button className="acid" disabled={!selection || job === 'running'} onClick={repaint}>
          {job === 'running' ? 'REPAINTING…' : 'REPAINT REGION'}
        </button>
      </section>
      {error && <div className="error">{error} <button onClick={repaint}>RETRY</button></div>}
      {baseLayer && baseLayer.versions.length > 0 && (
        <section className="versions">
          <div className="section-label">HISTORY</div>
          {baseLayer.versions.map((v) => (
            <div key={v.id} className={v.active ? 'version current' : 'version'}>
              <span>{v.label || 'version'}</span>
              <span className="meta">{new Date(v.created_at + 'Z').toLocaleString()}</span>
              {v.active
                ? <span className="badge">CURRENT</span>
                : <button onClick={() => revert(v.id)}>REVERT</button>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
