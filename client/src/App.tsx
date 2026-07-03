import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type Song } from './api';
import { Editor } from './Editor';
import { Player } from './Player';
import { CreateBar } from './CreateBar';
import { CreateView } from './CreateView';
import { LibraryToolbar, type LibraryFilter, type LibrarySort } from './LibraryToolbar';
import { motion, AnimatePresence } from 'framer-motion';
import { useSingleAudioPlayback } from './useSingleAudioPlayback';
import { Header } from './Header';
import { HeaderSlotContext } from './HeaderSlot';
import { MaterializeSweep } from './MaterializeSweep';

type View = 'library' | 'create';

export default function App() {
  const [view, setView] = useState<View>('library');
  const [createDraft, setCreateDraft] = useState('');
  const [openSongId, setOpenSongId] = useState<string | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<LibrarySort>('newest');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [online, setOnline] = useState<boolean | null>(null);
  const [playing, setPlaying] = useState<Song | null>(null);
  const [headerLeft, setHeaderLeft] = useState<ReactNode>(null);
  const [headerRight, setHeaderRight] = useState<ReactNode>(null);
  const setHeaderSlot = useCallback((left: ReactNode, right: ReactNode) => {
    setHeaderLeft(left);
    setHeaderRight(right);
  }, []);
  const footerEngine = useSingleAudioPlayback(playing?.audio_file ? `/audio/${playing.audio_file}` : '', true);

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

  // library player stops (not pauses) when the editor opens, per PLAN.md's Custom Player Controls section
  useEffect(() => {
    if (openSongId) footerEngine.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSongId]);

  const play = (s: Song) => setPlaying(s);

  const visibleSongs = useMemo(() => {
    let list = filter === 'favorites' ? songs.filter((s) => s.favorite) : songs;
    list = [...list].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      const at = new Date(a.created_at).getTime();
      const bt = new Date(b.created_at).getTime();
      return sort === 'oldest' ? at - bt : bt - at;
    });
    return list;
  }, [songs, sort, filter]);

  return (
    <div className={openSongId || view === 'create' ? 'app app-editor' : 'app'}>
      <HeaderSlotContext.Provider value={setHeaderSlot}>
      <Header online={online} left={headerLeft} right={headerRight} />
      <AnimatePresence mode="wait">
        {openSongId ? (
          <motion.div key="editor" initial={{ opacity: 0, x: 20, scale: 0.985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
            <MaterializeSweep />
            <Editor songId={openSongId} onBack={() => { setOpenSongId(null); refresh(); }} />
          </motion.div>
        ) : view === 'create' ? (
          <motion.div key="create" initial={{ opacity: 0, x: 20, scale: 0.985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
            <MaterializeSweep />
            <CreateView
              songs={songs}
              initialPrompt={createDraft}
              onBack={() => setView('library')}
              onCreated={() => { refresh(); setView('library'); }}
            />
          </motion.div>
        ) : (
          <motion.div key="library" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
            <CreateBar onCreate={(draftPrompt) => { setCreateDraft(draftPrompt); setView('create'); }} />

            <LibraryToolbar
              query={query}
              onQuery={(v) => { setQuery(v); refresh(v); }}
              sort={sort}
              onSort={setSort}
              filter={filter}
              onFilter={setFilter}
            />

            <section className="library">
              {visibleSongs.map((s, i) => (
                <motion.div
                  key={s.id}
                  className="row"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, delay: Math.min(i * 0.05, 0.5) }}
                >
                  <button onClick={() => play(s)}>▶</button>
                  <div className="row-main">
                    <span className="song-title link" onClick={() => setOpenSongId(s.id)}>{s.title}</span>
                    <span className="meta">{s.caption}</span>
                  </div>
                  <div className="row-actions">
                    <button onClick={() => setOpenSongId(s.id)}>EDIT</button>
                    <button className={s.favorite ? 'fav on' : 'fav'} onClick={() => api.setFavorite(s.id, !s.favorite).then(() => refresh())}>♥</button>
                    <button onClick={() => api.trash(s.id).then(() => refresh())}>✕</button>
                  </div>
                </motion.div>
              ))}
              {visibleSongs.length === 0 && <div className="empty">No songs yet — generate your first one above.</div>}
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* docked to the bottom of the app; slides down (not unmount) while the editor/create screen is
          open so it reappears stopped, not restarted, on return — audio itself is actually stopped by
          the openSongId effect above. Slides up the first time a song is selected to play. */}
      <AnimatePresence>
        {playing?.audio_file && (
          <motion.footer
            key="footer"
            initial={{ y: '100%' }}
            animate={{ y: openSongId || view === 'create' ? '100%' : 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <Player
              engine={footerEngine}
              downloadSrc={`/audio/${playing.audio_file}`}
              title={playing.title}
              downloadName={`${playing.title}.wav`}
            />
          </motion.footer>
        )}
      </AnimatePresence>
      </HeaderSlotContext.Provider>
    </div>
  );
}
