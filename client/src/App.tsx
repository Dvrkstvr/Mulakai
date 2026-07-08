import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type Song } from './api';
import { Editor } from './Editor';
import { Player } from './Player';
import { CreateBar } from './CreateBar';
import { CreateView } from './CreateView';
import { SongDetailRail } from './SongDetailRail';
import { reusePromptDraft, createCoverDraft, type CreateDraft } from './createDraft';
import { LibraryToolbar, type LibraryFilter, type LibrarySort } from './LibraryToolbar';
import { motion, AnimatePresence } from 'framer-motion';
import { useSingleAudioPlayback } from './useSingleAudioPlayback';
import { Header } from './Header';
import { HeaderSlotContext } from './HeaderSlot';
import { NavigationContext } from './Navigation';
import { MaterializeSweep } from './MaterializeSweep';
import { ScrollArea } from './ScrollArea';
import { SettingsView } from './SettingsView';
import { ForgeStub } from './ForgeStub';
import { useSettings } from './settings';
import { useGenerationStore } from './generationStore';
import { GeneratingCard } from './GeneratingCard';
import { useEditorJobStore } from './editorJobStore';
import { LibraryJobBadge } from './LibraryJobBadge';

type View = 'library' | 'create' | 'settings' | 'forge';

export default function App() {
  const [view, setView] = useState<View>('library');
  const [createDraft, setCreateDraft] = useState<CreateDraft>({});
  const [openSongId, setOpenSongId] = useState<string | null>(null);
  const [detailSongId, setDetailSongId] = useState<string | null>(null);
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
  const forgeEnabled = useSettings((s) => s.forgeEnabled);
  const navValue = useMemo(() => ({ goToSettings: () => setView('settings') }), []);
  const isTakeover = view === 'create' || view === 'settings' || view === 'forge';
  const genJob = useGenerationStore((s) => s.job);
  const dismissGenJob = useGenerationStore((s) => s.dismiss);
  const hydrateGenJob = useGenerationStore((s) => s.hydrate);
  const editorJob = useEditorJobStore((s) => s.editorJob);

  const refresh = (q = query) => api.listSongs(q).then(setSongs).catch(() => {});

  useEffect(() => {
    refresh();
    hydrateGenJob();
    const checkHealth = () =>
      api.acestepHealth().then((h) => setOnline(h.acestep)).catch(() => setOnline(false));
    checkHealth();
    const timer = setInterval(checkHealth, 10_000);
    // Keeps generationStore's otherLock live so the editor's repaint/remaster/split/add-layer
    // triggers can proactively disable themselves while a generation is running anywhere,
    // not just fail with a 409 after the fact.
    const lockTimer = setInterval(() => useGenerationStore.getState().refreshLock(), 3000);
    return () => { clearInterval(timer); clearInterval(lockTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The generating card's own store clears `job` a moment after it flips to 'done' (see
  // generationStore.ts's DONE_LINGER_MS) — refresh the library right as that happens so
  // the real song row is already in `songs` by the time the placeholder unmounts, then load
  // the freshly generated song into the footer player so it's ready to hit play immediately.
  useEffect(() => {
    if (genJob?.stage !== 'done' || !genJob.songId) return;
    const newSongId = genJob.songId;
    api.listSongs(query).then((list) => {
      setSongs(list);
      const newSong = list.find((s) => s.id === newSongId);
      if (newSong) setPlaying(newSong);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genJob?.stage]);

  const retryGeneration = () => {
    if (!genJob) return;
    setCreateDraft(genJob.draft);
    dismissGenJob();
    setView('create');
  };

  // library player stops (not pauses) when the editor or any takeover screen opens, per PLAN.md's Custom Player Controls section
  useEffect(() => {
    if (openSongId || isTakeover) footerEngine.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSongId, view]);

  // Quick-preview from the library: re-clicking the row that's already loaded toggles
  // play/pause on the existing footer engine instead of restarting it from a new src.
  const togglePlay = (s: Song) => {
    if (playing?.id === s.id) {
      if (footerEngine.isPlaying) footerEngine.pause(); else footerEngine.play();
    } else {
      setPlaying(s);
    }
  };

  const openEditor = (id: string) => { setDetailSongId(null); setOpenSongId(id); };
  const reusePrompt = (s: Song) => { setCreateDraft(reusePromptDraft(s)); setDetailSongId(null); setView('create'); };
  const createCover = (s: Song) => { setCreateDraft(createCoverDraft(s)); setDetailSongId(null); setView('create'); };

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
    <div className={openSongId || isTakeover ? 'app app-editor' : 'app'}>
      <NavigationContext.Provider value={navValue}>
      <HeaderSlotContext.Provider value={setHeaderSlot}>
      <Header online={online} left={headerLeft} right={headerRight} forgeEnabled={forgeEnabled} onForge={() => setView('forge')} />
      <div className="app-body">
      <AnimatePresence mode="wait">
        {openSongId ? (
          <motion.div className="view-fill" key="editor" initial={{ opacity: 0, x: 20, scale: 0.985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
            <MaterializeSweep />
            <Editor songId={openSongId} onBack={() => { setOpenSongId(null); refresh(); }} />
          </motion.div>
        ) : view === 'create' ? (
          <motion.div className="view-fill" key="create" initial={{ opacity: 0, x: 20, scale: 0.985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
            <MaterializeSweep />
            <CreateView
              songs={songs}
              initialDraft={createDraft}
              onBack={() => setView('library')}
            />
          </motion.div>
        ) : view === 'settings' ? (
          <motion.div className="view-fill" key="settings" initial={{ opacity: 0, x: 20, scale: 0.985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
            <MaterializeSweep />
            <SettingsView online={online} onBack={() => setView('library')} />
          </motion.div>
        ) : view === 'forge' ? (
          <motion.div className="view-fill" key="forge" initial={{ opacity: 0, x: 20, scale: 0.985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
            <MaterializeSweep />
            <ForgeStub onBack={() => setView('library')} />
          </motion.div>
        ) : (
          <motion.div className="view-fill" key="library" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
            <CreateBar
              onCreate={(draft) => { setCreateDraft(draft); setView('create'); }}
              busy={!!genJob && genJob.stage !== 'failed'}
            />

            <LibraryToolbar
              query={query}
              onQuery={(v) => { setQuery(v); refresh(v); }}
              sort={sort}
              onSort={setSort}
              filter={filter}
              onFilter={setFilter}
              onSettings={() => setView('settings')}
            />

            <ScrollArea className="library-layout">
              <section className="library">
                {genJob && <GeneratingCard job={genJob} onRetry={retryGeneration} />}
                {visibleSongs.map((s, i) => (
                  <motion.div
                    key={s.id}
                    className={s.id === detailSongId ? 'row selected' : 'row'}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(i * 0.05, 0.5) }}
                  >
                    <button onClick={() => togglePlay(s)} aria-label={playing?.id === s.id && footerEngine.isPlaying ? 'Pause' : 'Play'}>
                      {playing?.id === s.id && footerEngine.isPlaying ? '⏸' : '▶'}
                    </button>
                    <div className="row-main">
                      <span className="song-title link" onClick={() => setDetailSongId(s.id)}>{s.title}</span>
                      <span className="meta">{s.caption}</span>
                      {editorJob?.songId === s.id && <LibraryJobBadge job={editorJob} />}
                    </div>
                    <div className="row-actions">
                      <button className="edit-btn" onClick={() => openEditor(s.id)}><span>EDIT</span></button>
                      <button className={s.favorite ? 'fav on' : 'fav'} onClick={() => api.setFavorite(s.id, !s.favorite).then(() => refresh())}>♥</button>
                      <button onClick={() => api.trash(s.id).then(() => refresh())}>✕</button>
                    </div>
                  </motion.div>
                ))}
                {visibleSongs.length === 0 && !genJob && <div className="empty">No songs yet — generate your first one above.</div>}
              </section>
              {detailSongId && (() => {
                const detailSong = songs.find((s) => s.id === detailSongId);
                return detailSong ? (
                  <SongDetailRail
                    song={detailSong}
                    onClose={() => setDetailSongId(null)}
                    onReusePrompt={reusePrompt}
                    onCreateCover={createCover}
                    onRenamed={() => refresh()}
                  />
                ) : null;
              })()}
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* docked to the bottom of the app; slides down (not unmount) while the editor/create screen is
          open so it reappears stopped, not restarted, on return — audio itself is actually stopped by
          the openSongId effect above. Slides up the first time a song is selected to play. */}
      <AnimatePresence>
        {playing?.audio_file && (
          <motion.footer
            key="footer"
            initial={{ y: '100%' }}
            animate={{ y: openSongId || isTakeover ? '100%' : 0 }}
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
      </NavigationContext.Provider>
    </div>
  );
}
