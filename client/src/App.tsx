import { useEffect, useRef, useState } from 'react';
import { api, type Song } from './api';
import { Editor } from './Editor';
import { SettingsPanel } from './SettingsPanel';
import { useSettings, genParams } from './settings';
import { motion, AnimatePresence } from 'framer-motion';
import { AIGeneratingBackground } from './AIGeneratingBackground';

export default function App() {
  const gen = useSettings((s) => s.gen);
  const [openSongId, setOpenSongId] = useState<string | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [query, setQuery] = useState('');
  const [online, setOnline] = useState<boolean | null>(null);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [job, setJob] = useState<'idle' | 'running' | 'failed'>('idle');
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState<Song | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const refresh = (q = query) => api.listSongs(q).then(setSongs).catch(() => {});

  useEffect(() => {
    refresh();
    const checkHealth = () =>
      api.acestepHealth().then((h) => setOnline(h.acestep)).catch(() => setOnline(false));
    checkHealth();
    const timer = setInterval(checkHealth, 10_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = async () => {
    setError('');
    setJob('running');
    try {
      const { jobId } = await api.generate({ title: title || 'Untitled', prompt, lyrics, ...genParams(gen) });
      for (;;) {
        await new Promise((r) => setTimeout(r, 2000));
        const s = await api.jobStatus(jobId);
        if (s.status === 'done') {
          setJob('idle');
          refresh();
          return;
        }
        if (s.status === 'failed') throw new Error(s.error ?? 'generation failed');
      }
    } catch (err) {
      setJob('failed');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="app">
      <AnimatePresence mode="wait">
        {openSongId ? (
          <motion.div key="editor" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            <Editor songId={openSongId} onBack={() => { setOpenSongId(null); refresh(); }} />
          </motion.div>
        ) : (
          <motion.div key="library" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
            <header>
        <span className="logo">MULAKAI</span>
        <input
          placeholder="Search songs, styles, lyrics"
          value={query}
          onChange={(e) => { setQuery(e.target.value); refresh(e.target.value); }}
        />
        <span className={`health ${online ? 'ok' : 'down'}`}>
          ACE-STEP {online === null ? '…' : online ? 'ONLINE' : 'OFFLINE'}
        </span>
      </header>

      <div className="with-panel">
        <SettingsPanel mode="generate" />
        <section className="create">
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input placeholder="Describe it — style, mood, instruments" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <textarea placeholder="[verse]&#10;Lyrics (optional)" value={lyrics} onChange={(e) => setLyrics(e.target.value)} />
          <motion.button
            className="acid"
            animate={job === 'running' ? {
              skewX: 0,
              backgroundColor: 'transparent',
              color: '#D4FF00'
            } : {
              skewX: -10,
              backgroundColor: '#D4FF00',
              color: '#1C1D21'
            }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ position: 'relative', overflow: 'hidden' }}
            disabled={job === 'running' || !prompt}
            onClick={generate}
          >
            {job === 'running' ? (
              <>
                <AIGeneratingBackground />
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  GENERATING…
                </span>
              </>
            ) : 'GENERATE'}
          </motion.button>
          {error && <div className="error">{error} <button onClick={generate}>RETRY</button></div>}
        </section>
      </div>

      <section className="library">
        {songs.map((s, i) => (
          <motion.div
            key={s.id}
            className="row"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, delay: Math.min(i * 0.05, 0.5) }}
          >
            <button onClick={() => { setPlaying(s); setTimeout(() => audioRef.current?.play(), 0); }}>▶</button>
            <span className="song-title link" onClick={() => setOpenSongId(s.id)}>{s.title}</span>
            <span className="meta">{s.caption}</span>
            <button onClick={() => setOpenSongId(s.id)}>EDIT</button>
            <button className={s.favorite ? 'fav on' : 'fav'} onClick={() => api.setFavorite(s.id, !s.favorite).then(() => refresh())}>♥</button>
            <button onClick={() => api.trash(s.id).then(() => refresh())}>✕</button>
          </motion.div>
        ))}
        {songs.length === 0 && <div className="empty">No songs yet — generate your first one above.</div>}
      </section>
      </motion.div>
      )}
      </AnimatePresence>

      {playing?.audio_file && (
        <footer>
          <span className="song-title">{playing.title}</span>
          <audio ref={audioRef} controls src={`/audio/${playing.audio_file}`} />
        </footer>
      )}
    </div>
  );
}
