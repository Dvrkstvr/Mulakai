import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Song } from './api';
import { Editor } from './Editor';
import { CreateView } from './CreateView';
import { createCoverDraft, draftHasIntent, type CreateDraft, type GenType } from './createDraft';
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
import { useFooterMode } from './useFooterMode';
import { CommandActivityLayer } from './CommandActivityLayer';
import { scrollToSettingsSection } from './settingsSections';
import { ChatView } from './ChatView';
import { chatShown } from './chatEntry';
import { useChatStore } from './chatStore';
import { useChatBoot } from './useChatBoot';

type View = 'library' | 'chat' | 'create' | 'settings' | 'forge';

export default function App() {
  const [view, setView] = useState<View>('library');
  /** Where Create's BACK returns: CHAT when FORM ▸ opened it there. */
  const [createBack, setCreateBack] = useState<View>('library');
  const chatOn = chatShown(useChatStore((s) => s.status));
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
  /** CHAT (D-099): a song's thread from OPEN CHAT, else the thread already open, else the draft thread. */
  const openChat = useCallback((songId?: string) => {
    setOpenSongId(null);
    setDetailSongId(null);
    setView('chat');
    const chat = useChatStore.getState();
    if (songId) void chat.openSong(songId);
    else if (!chat.thread) void chat.openDraft();
  }, []);
  useChatBoot();
  const navValue = useMemo(() => ({ goToSettings: () => setView('settings'), openEditor, openChat }), [openEditor, openChat]);
  const isTakeover = view === 'create' || view === 'settings' || view === 'forge' || view === 'chat';
  const showLibrary = (songId: string | null = null) => { setView('library'); setDetailSongId(songId); refresh(); };
  const genJobs = useGenerationStore((s) => s.jobs);
  const dismissGenJob = useGenerationStore((s) => s.dismiss);
  const hydrateGenJob = useGenerationStore((s) => s.hydrate);

  useAppSync({ library, genJobs, hydrateGenJob, setPlaying });
  const footer = useFooterMode({
    songKey: playing?.audio_file ? playing.id : null, isPlaying: footerEngine.isPlaying, onLibrary: !openSongId && view === 'library',
  });

  /** Every route into Create goes through here. A draft that actually asks for something
   * (a create-bar query, REUSE PROMPT, CREATE COVER FROM AUDIO, RETRY) replaces whatever was
   * in Create; CREATE on an empty box means "take me back", so it keeps the draft in progress
   * and only re-points its destination at the folder now in scope. */
  const openCreate = (draft: CreateDraft) => {
    const store = useCreateDraftStore.getState();
    if (draftHasIntent(draft)) store.load(draft); else store.resume(draft.folderId, draft.folderName);
    setCreateBack('library');
    setView('create');
  };

  // Palette and Activity routes. Leaving the Editor this way refreshes the Library as BACK does.
  const leaveEditor = () => {
    if (!openSongId) return;
    setOpenSongId(null);
    refresh();
    refreshFolders();
  };
  const showCreate = (genType?: GenType) => {
    if (genType) useCreateDraftStore.getState().patch({ genType });
    leaveEditor();
    setView('create');
  };
  const loadCreate = (draft: CreateDraft) => { leaveEditor(); openCreate(draft); };
  const remake = (s: Song) => {
    const f = library.folders.find((x) => x.id === s.folder_id);
    loadCreate({ ...createCoverDraft(s), ...(f ? { folderId: f.id, folderName: f.name } : {}) });
  };
  const openFolder = (id: string) => { leaveEditor(); setDetailSongId(null); setView('library'); library.setFolderScope(id); };
  const openSettings = (id: string) => { leaveEditor(); setView('settings'); scrollToSettingsSection(id); };

  // library player stops (not pauses) when the editor or any takeover screen opens, per PLAN.md's Custom Player Controls section
  useEffect(() => {
    if (openSongId || isTakeover) footerEngine.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSongId, view]);

  return (
    <div className={footer.docked ? 'app footer-docked' : 'app'}>
      <NavigationContext.Provider value={navValue}>
      <HeaderSlotContext.Provider value={setHeaderSlot}>
      <Header
        left={headerLeft} right={headerRight} forgeEnabled={forgeEnabled} onForge={() => setView('forge')}
        views={chatOn && !openSongId && (view === 'chat' || view === 'library')
          ? { active: view, onChat: () => openChat(), onLibrary: () => showLibrary() } : null}
      />
      <div className="app-body">
      <AnimatePresence mode="wait">
        {openSongId ? (
          <motion.div className="view-fill" key="editor" initial={{ opacity: 0, x: 20, scale: 0.985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
            <MaterializeSweep />
            {/* refreshFolders too: an import lands here directly, so leaving the editor is
                the first moment the destination folder's song count can be re-read. */}
            <Editor key={openSongId} songId={openSongId} onBack={() => { setOpenSongId(null); refresh(); refreshFolders(); }} />
          </motion.div>
        ) : view === 'create' ? (
          <motion.div className="view-fill" key="create" initial={{ opacity: 0, x: 20, scale: 0.985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
            <MaterializeSweep />
            <CreateView songs={songs} onBack={() => setView(createBack)} />
          </motion.div>
        ) : view === 'chat' ? (
          <motion.div className="view-fill" key="chat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            <ChatView onForm={() => { setCreateBack('chat'); setView('create'); }} onLibrary={showLibrary} />
          </motion.div>
        ) : view === 'settings' ? (
          <motion.div className="view-fill" key="settings" initial={{ opacity: 0, x: 20, scale: 0.985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
            <MaterializeSweep />
            <SettingsView online={online} onBack={() => { showLibrary(); refreshFolders(); }} />
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
              genJobs={genJobs}
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

      <PlayerFooter playing={playing} engine={footerEngine} state={footer} />
      <CommandActivityLayer
        folders={library.folders} openEditor={openEditor} openFolder={openFolder} showCreate={showCreate}
        loadCreate={loadCreate} remake={remake} openSettings={openSettings}
      />
      </HeaderSlotContext.Provider>
      </NavigationContext.Provider>
    </div>
  );
}
