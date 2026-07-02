import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type SongDetail } from './api';
import { Waveform, type Region } from './Waveform';
import { SettingsPanel } from './SettingsPanel';
import { useSettings, repaintParams } from './settings';
import { motion, AnimatePresence } from 'framer-motion';
import { AIGeneratingBackground } from './AIGeneratingBackground';

interface Props {
  songId: string;
  onBack: () => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function Editor({ songId, onBack }: Props) {
  const repaintSettings = useSettings((s) => s.repaint);
  const [song, setSong] = useState<SongDetail | null>(null);
  const [selection, setSelection] = useState<Region | null>(null);
  const [prompt, setPrompt] = useState('');
  const [job, setJob] = useState<'idle' | 'running'>('idle');
  const [error, setError] = useState('');
  const [playhead, setPlayhead] = useState(0);
  const [isReverting, setIsReverting] = useState(false);
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
        ...repaintParams(repaintSettings),
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
    setIsReverting(true);
    await new Promise(r => setTimeout(r, 600)); // wait for fade out
    await api.activateVersion(versionId);
    await reload();
    setIsReverting(false);
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

      <div className="with-panel">
        <SettingsPanel mode="repaint" />
        <div className="editor-main">
      <AnimatePresence>
      {activeVersion && (
        <motion.section key="canvas" className="canvas" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
          <Waveform
            audioUrl={`/audio/${activeVersion.audio_file}`}
            duration={duration}
            selection={selection}
            onSelect={setSelection}
            playhead={playhead}
            isFadingOut={isReverting}
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
        </motion.section>
      )}
      </AnimatePresence>

      <motion.section className="repaint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: 0.1 }}>
        <motion.div className="scope-chip" layout>
          {selection ? `${fmt(selection.start)}–${fmt(selection.end)} · BASE` : 'NO SELECTION'}
        </motion.div>
        <input
          placeholder="Describe what should change in the selected region"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <motion.button
          className="acid"
          animate={job === 'running' ? {
            skewX: 0,
            backgroundColor: 'transparent',
            color: '#D4FF00'
          } : {
            skewX: selection ? -10 : 0,
            backgroundColor: '#D4FF00',
            color: '#1C1D21'
          }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{ position: 'relative', overflow: 'hidden' }}
          disabled={!selection || job === 'running'}
          onClick={repaint}
        >
          {job === 'running' ? (
            <>
              <AIGeneratingBackground />
              <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                REPAINTING…
              </span>
            </>
          ) : 'REPAINT REGION'}
        </motion.button>
      </motion.section>
      {error && <div className="error">{error} <button onClick={repaint}>RETRY</button></div>}
      <AnimatePresence>
      {baseLayer && baseLayer.versions.length > 0 && (
        <motion.section className="versions" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
          <div className="section-label">HISTORY</div>
          {baseLayer.versions.map((v) => (
            <motion.div layout key={v.id} className={v.active ? 'version current' : 'version'}>
              <span>{v.label || 'version'}</span>
              <span className="meta">{new Date(v.created_at + 'Z').toLocaleString()}</span>
              {v.active
                ? <span className="badge">CURRENT</span>
                : <button onClick={() => revert(v.id)}>REVERT</button>}
            </motion.div>
          ))}
        </motion.section>
      )}
      </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
