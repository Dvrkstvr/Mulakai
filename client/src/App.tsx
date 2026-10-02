import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Song } from './api';
import { Editor } from './Editor';
import { CreateView } from './CreateView';
import { draftHasIntent, type CreateDraft } from './createDraft';
import { useCreateDraftStore } from './createDraftStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useSingleAudioPlayback } from './useSingleAudioPlayback';
import { useMainTransportGuard } from './previewPlayback';
import { Header } from './Header';
import { isAcestepOnline, useModelStatusStore } from './modelStatusStore';
import { HeaderSlotContext } from './HeaderSlot';
import { NavigationContext } from './Navigation';
import { MaterializeSweep } from './MaterializeSweep';
import { SettingsView } from './SettingsView';
import { ForgeStub } from './ForgeStub';
import { useSettings } from './settings';
import { useGenerationStore } from './generationStore';
import { useLibraryData } from './useLibraryData';
import { useAppSync } from './useAppSync';
import { LibraryView } from './LibraryView';
import { PlayerFooter } from './PlayerFooter';

type View = 'library' | 'create' | 'settings' | 'forge';

export default function App() {
  const [view, setView] = useState<View>('library');
  const [openSongId, setOpenSongId] = useState<string | null>(null);
  const [detailSongId, setDetailSongId] = useState<string | null>(null);
  const library = useLibraryData();
  const { songs, refresh, refreshFolders } = library;
  const online = isAcestepOnline(useModelStatusStore((s) => s.acestep));
  const [playing, setPlaying] = useState<Song | null>(null);
  const [headerLeft, setHeaderLeft] = useState<ReactNode>(null);
  const [headerRight, setHeaderRight] = useState<ReactNode>(null);
  const setHeaderSlot = useCallback((left: ReactNode, right: ReactNode) => {
    setHeaderLeft(left);
    setHeaderRight(right);
  }, []);
  const footerEngine = useSingleAudioPlayback(playing?.audio_file ? `/audio/${playing.audio_file}` : '', true);
  useMainTransportGuard(footerEngine);
  const forgeEnabled = useSettings((s) => s.forgeEnabled);
  /** Also leaves whichever takeover view is up, so Create's MOVE TO EDITOR lands directly on
   * the song it imported rather than behind the Create screen. A no-op from library rows. */
  const openEditor = useCallback((id: string) => {
    setDetailSongId(null);
    setView('library');
    setOpenSongId(id);
  }, []);
  const navValue = useMemo(() => ({ goToSettings: () => setView('settings'), openEditor }), [openEditor]);
  const isTakeover = view === 'create' || view === 'settings' || view === 'forge';
  const genJob = useGenerationStore((s) => s.job);
  const dismissGenJob = useGenerationStore((s) => s.dismiss);
  const hydrateGenJob = useGenerationStore((s) => s.hydrate);

  useAppSync({ library, genJob, hydrateGenJob, setPlaying });

  /** Every route into Create goes through here. A draft that actually asks for something
   * (a create-bar query, REUSE PROMPT, CREATE COVER FROM AUDIO, RETRY) replaces whatever was
   * in Create; CREATE on an empty box means "take me back", so it keeps the draft in progress
   * and only re-points its destination at the folder now in scope. */
  const openCreate = (draft: CreateDraft) => {
    const store = useCreateDraftStore.getState();
    if (draftHasIntent(draft)) store.load(draft); else store.resume(draft.folderId, draft.folderName);
    setView('create');
  };

  // library player stops (not pauses) when the editor or any takeover screen opens, per PLAN.md's Custom Player Controls section
  useEffect(() => {
    if (openSongId || isTakeover) footerEngine.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSongId, view]);

  return (
    <div className={openSongId || isTakeover ? 'app app-editor' : 'app'}>
      <NavigationContext.Provider value={navValue}>
      <HeaderSlotContext.Provider value={setHeaderSlot}>
      <Header left={headerLeft} right={headerRight} forgeEnabled={forgeEnabled} onForge={() => setView('forge')} />
      <div className="app-body">
      <AnimatePresence mode="wait">
        {openSongId ? (
          <motion.div className="view-fill" key="editor" initial={{ opacity: 0, x: 20, scale: 0.985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
            <MaterializeSweep />
            {/* refreshFolders too: an import lands here directly, so leaving the editor is
                the first moment the destination folder's song count can be re-read. */}
            <Editor songId={openSongId} onBack={() => { setOpenSongId(null); refresh(); refreshFolders(); }} />
          </motion.div>
        ) : view === 'create' ? (
          <motion.div className="view-fill" key="create" initial={{ opacity: 0, x: 20, scale: 0.985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
            <MaterializeSweep />
            <CreateView songs={songs} onBack={() => setView('library')} />
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
            <LibraryView
              library={library}
              genJob={genJob}
              dismissGenJob={dismissGenJob}
              detailSongId={detailSongId}
              setDetailSongId={setDetailSongId}
              playing={playing}
              setPlaying={setPlaying}
              footerEngine={footerEngine}
              openEditor={openEditor}
              openCreate={openCreate}
              onSettings={() => setView('settings')}
            />
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      <PlayerFooter playing={playing} engine={footerEngine} hidden={!!openSongId || isTakeover} />
      </HeaderSlotContext.Provider>
      </NavigationContext.Provider>
    </div>
  );
}
