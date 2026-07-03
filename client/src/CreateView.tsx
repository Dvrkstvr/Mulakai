import { useMemo, useRef, useState } from 'react';
import { api, type Song } from './api';
import { SettingsPanel } from './SettingsPanel';
import { useSettings, genParams } from './settings';
import { motion } from 'framer-motion';
import { AIGeneratingBackground } from './AIGeneratingBackground';
import { useHeaderSlot } from './HeaderSlot';

type GenType = 'prompt' | 'audio';
type Source = 'upload' | 'library';

interface Props {
  songs: Song[];
  initialPrompt: string;
  onBack: () => void;
  onCreated: () => void;
}

/** Dedicated Create takeover — reached from the Library create bar, per docs/design/DESIGN.md. */
export function CreateView({ songs, initialPrompt, onBack, onCreated }: Props) {
  const gen = useSettings((s) => s.gen);
  const [genType, setGenType] = useState<GenType>('prompt');
  const [source, setSource] = useState<Source>('upload');
  const [librarySearch, setLibrarySearch] = useState('');
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState(initialPrompt);
  const [lyrics, setLyrics] = useState('');
  const [job, setJob] = useState<'idle' | 'running' | 'failed'>('idle');
  const [stage, setStage] = useState<'loading' | 'running'>('running');
  const [error, setError] = useState('');

  const generate = async () => {
    setError('');
    setJob('running');
    setStage('loading');
    try {
      const { jobId } = await api.generate({ title: title || 'Untitled', prompt, lyrics, ...genParams(gen) });
      for (;;) {
        await new Promise((r) => setTimeout(r, 2000));
        const s = await api.jobStatus(jobId);
        if (s.status === 'loading' || s.status === 'running') setStage(s.status);
        if (s.status === 'done') { setJob('idle'); onCreated(); return; }
        if (s.status === 'failed') throw new Error(s.error ?? 'generation failed');
      }
    } catch (err) {
      setJob('failed');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const visibleLibrary = songs.filter((s) => s.title.toLowerCase().includes(librarySearch.toLowerCase()));

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const headerLeft = useMemo(() => <button onClick={() => onBackRef.current()}>&#8592; LIBRARY</button>, []);
  const headerRight = useMemo(() => (
    <>
      <span className="song-title" style={{ fontSize: 16, letterSpacing: 1 }}>New song</span>
      <span className="meta">
        {genType === 'prompt' ? 'will appear in your library once generated' : 'will generate a new song using this audio as reference'}
      </span>
    </>
  ), [genType]);
  useHeaderSlot(headerLeft, headerRight);

  return (
    <div>
      <div className="with-panel create-layout">
        <SettingsPanel mode="generate" hideLmControls={genType === 'audio'} />
        <div className="create-content">
          <div className="section-label">GENERATION TYPE</div>
          <div className="type-tabs">
            <button className={genType === 'prompt' ? 'tab active' : 'tab'} onClick={() => setGenType('prompt')}><span>PROMPT</span></button>
            <button className={genType === 'audio' ? 'tab active' : 'tab'} onClick={() => setGenType('audio')}><span>AUDIO</span></button>
          </div>

          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />

          {genType === 'audio' && (
            <>
              <div className="section-label">SOURCE</div>
              <div className="type-tabs">
                <button className={source === 'upload' ? 'tab active' : 'tab'} onClick={() => setSource('upload')}><span>UPLOAD</span></button>
                <button className={source === 'library' ? 'tab active' : 'tab'} onClick={() => setSource('library')}><span>FROM LIBRARY</span></button>
              </div>
              {source === 'upload' ? (
                <label className="dropzone">
                  <input type="file" accept="audio/*" style={{ display: 'none' }} />
                  drag audio file here or click to browse
                </label>
              ) : (
                <div className="song-picker">
                  <input placeholder="Search your library…" value={librarySearch} onChange={(e) => setLibrarySearch(e.target.value)} />
                  <div className="song-picker-list">
                    {visibleLibrary.map((s) => (
                      <div
                        key={s.id}
                        className={s.id === selectedSongId ? 'song-pick current' : 'song-pick'}
                        onClick={() => setSelectedSongId(s.id)}
                      >
                        {s.title}
                      </div>
                    ))}
                    {visibleLibrary.length === 0 && <div className="empty">No songs match.</div>}
                  </div>
                </div>
              )}
            </>
          )}

          <input
            placeholder={genType === 'audio' ? 'Describe the change — style, mood, instruments' : 'Describe it — style, mood, instruments'}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          {genType === 'prompt' && (
            <div className="lm-note">LM MODEL reads this and fills in bpm, key, structure — nothing else to set.</div>
          )}

          {genType === 'prompt' && (
            <textarea placeholder="[verse]&#10;Lyrics (optional)" value={lyrics} onChange={(e) => setLyrics(e.target.value)} />
          )}

          <motion.button
            className="acid"
            animate={job === 'running' ? {
              skewX: 0, backgroundColor: 'transparent', color: '#D4FF00',
            } : {
              skewX: -10, backgroundColor: '#D4FF00', color: '#1C1D21',
            }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ position: 'relative', overflow: 'hidden' }}
            disabled={genType === 'audio' || job === 'running' || !prompt}
            onClick={generate}
          >
            {job === 'running' ? (
              <>
                <AIGeneratingBackground />
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  {stage === 'loading' ? 'LOADING MODEL…' : 'GENERATING…'}
                </span>
              </>
            ) : genType === 'audio' ? 'AUDIO GENERATION — COMING SOON' : 'GENERATE'}
          </motion.button>
          {genType === 'audio' && (
            <div className="hint">Cover generation from an uploaded or library source isn't wired to the backend yet — scoped as a follow-up.</div>
          )}
          {error && <div className="error">{error} <button onClick={generate}>RETRY</button></div>}
        </div>
      </div>
    </div>
  );
}
