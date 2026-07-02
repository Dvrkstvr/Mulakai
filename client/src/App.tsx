import { useEffect, useRef, useState } from 'react';
import { api, type Song } from './api';
import { Editor } from './Editor';

export default function App() {
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
      const { jobId } = await api.generate({ title: title || 'Untitled', prompt, lyrics });
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

  if (openSongId) {
    return (
      <div className="app">
        <Editor songId={openSongId} onBack={() => { setOpenSongId(null); refresh(); }} />
      </div>
    );
  }

  return (
    <div className="app">
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

      <section className="create">
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input placeholder="Describe it — style, mood, instruments" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <textarea placeholder="[verse]&#10;Lyrics (optional)" value={lyrics} onChange={(e) => setLyrics(e.target.value)} />
        <button className="acid" disabled={job === 'running' || !prompt} onClick={generate}>
          {job === 'running' ? 'GENERATING…' : 'GENERATE'}
        </button>
        {error && <div className="error">{error} <button onClick={generate}>RETRY</button></div>}
      </section>

      <section className="library">
        {songs.map((s) => (
          <div key={s.id} className="row">
            <button onClick={() => { setPlaying(s); setTimeout(() => audioRef.current?.play(), 0); }}>▶</button>
            <span className="song-title link" onClick={() => setOpenSongId(s.id)}>{s.title}</span>
            <span className="meta">{s.caption}</span>
            <button onClick={() => setOpenSongId(s.id)}>EDIT</button>
            <button className={s.favorite ? 'fav on' : 'fav'} onClick={() => api.setFavorite(s.id, !s.favorite).then(() => refresh())}>♥</button>
            <button onClick={() => api.trash(s.id).then(() => refresh())}>✕</button>
          </div>
        ))}
        {songs.length === 0 && <div className="empty">No songs yet — generate your first one above.</div>}
      </section>

      {playing?.audio_file && (
        <footer>
          <span className="song-title">{playing.title}</span>
          <audio ref={audioRef} controls src={`/audio/${playing.audio_file}`} />
        </footer>
      )}
    </div>
  );
}
