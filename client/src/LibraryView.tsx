import { motion } from 'framer-motion';
import { api, type Song } from './api';
import { FolderRail } from './FolderRail';
import { CreateBar } from './CreateBar';
import { SongDetailRail } from './SongDetailRail';
import { reusePromptDraft, createCoverDraft, type CreateDraft } from './createDraft';
import { LibraryToolbar } from './LibraryToolbar';
import { ScrollArea } from './ScrollArea';
import type { GenerationJob } from './generationStore';
import { isGenerating } from './generationJob';
import { GeneratingCard } from './GeneratingCard';
import { LibraryJobBadge } from './LibraryJobBadge';
import { ContinueRow } from './ContinueRow';
import type { PlaybackApi } from './mix/playerApi';
import type { LibraryData } from './useLibraryData';

interface Props {
  library: LibraryData;
  genJob: GenerationJob | null;
  dismissGenJob: () => void;
  detailSongId: string | null;
  setDetailSongId: (id: string | null) => void;
  playing: Song | null;
  setPlaying: (song: Song) => void;
  footerEngine: PlaybackApi;
  openEditor: (id: string) => void;
  openCreate: (draft: CreateDraft) => void;
  onSettings: () => void;
}

/** The library screen: the create bar, search/sort toolbar, folder rail, song list and the
 * selected song's detail rail. */
export function LibraryView({
  library, genJob, dismissGenJob, detailSongId, setDetailSongId, playing, setPlaying, footerEngine, openEditor, openCreate, onSettings,
}: Props) {
  const {
    songs, query, search, sort, setSort, filter, setFilter, folders, folderScope, setFolderScope,
    totalSongCount, activeFolder, unfiledCount, refresh, refreshFolders, createFolder, visibleSongs,
  } = library;

  const retryGeneration = () => {
    if (!genJob) return;
    dismissGenJob();
    openCreate(genJob.draft);
  };

  // Quick-preview from the library: re-clicking the row that's already loaded toggles
  // play/pause on the existing footer engine instead of restarting it from a new src.
  const togglePlay = (s: Song) => {
    if (playing?.id === s.id) {
      if (footerEngine.isPlaying) footerEngine.pause(); else footerEngine.play();
    } else {
      setPlaying(s);
    }
  };

  /** The folder a song already lives in, carried forward as the new draft's destination —
   * not the library's current browsing scope, since REUSE PROMPT/CREATE COVER act on a
   * specific song regardless of which folder view it was clicked from. */
  const songFolder = (s: Song) => folders.find((f) => f.id === s.folder_id);
  const reusePrompt = (s: Song) => {
    const folder = songFolder(s);
    setDetailSongId(null);
    openCreate({ ...reusePromptDraft(s), ...(folder ? { folderId: folder.id, folderName: folder.name } : {}) });
  };
  const createCover = (s: Song) => {
    const folder = songFolder(s);
    setDetailSongId(null);
    openCreate({ ...createCoverDraft(s), ...(folder ? { folderId: folder.id, folderName: folder.name } : {}) });
  };

  return (
    <>
      <CreateBar
        onCreate={(draft) => openCreate(activeFolder ? { ...draft, folderId: activeFolder.id, folderName: activeFolder.name } : draft)}
        busy={isGenerating(genJob)}
      />

      <LibraryToolbar
        query={query}
        onQuery={search}
        sort={sort}
        onSort={setSort}
        filter={filter}
        onFilter={setFilter}
        onSettings={onSettings}
      />

      <ScrollArea className="library-layout">
        <FolderRail
          folders={folders}
          scope={folderScope}
          onScope={setFolderScope}
          allCount={totalSongCount}
          unfiledCount={unfiledCount}
          onCreateFolder={createFolder}
        />
        <div className="library-main">
        <ContinueRow refreshKey={songs} openEditor={openEditor} resumeCreate={() => openCreate({})} />
        {(activeFolder || folderScope === 'unfiled') && (
          <div className="scope-crumb">
            <span className="name">{activeFolder ? activeFolder.name : 'Unfiled'}</span>
            <span className="count">{visibleSongs.length} song{visibleSongs.length === 1 ? '' : 's'}</span>
          </div>
        )}
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
                <LibraryJobBadge songId={s.id} />
              </div>
              <div className="row-actions">
                <button className="edit-btn" onClick={() => openEditor(s.id)}><span>EDIT</span></button>
                <button className={s.favorite ? 'fav on' : 'fav'} onClick={() => api.setFavorite(s.id, !s.favorite).then(() => refresh())}>♥</button>
                <button onClick={() => api.trash(s.id).then(() => { refresh(); refreshFolders(); })}>✕</button>
              </div>
            </motion.div>
          ))}
          {visibleSongs.length === 0 && !genJob && <div className="empty">No songs yet — generate your first one above.</div>}
        </section>
        </div>
        {detailSongId && (() => {
          const detailSong = songs.find((s) => s.id === detailSongId);
          return detailSong ? (
            <SongDetailRail
              song={detailSong}
              folders={folders}
              onClose={() => setDetailSongId(null)}
              onReusePrompt={reusePrompt}
              onCreateCover={createCover}
              onRenamed={() => { refresh(); refreshFolders(); }}
            />
          ) : null;
        })()}
      </ScrollArea>
    </>
  );
}
