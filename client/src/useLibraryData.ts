import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type Song, type Folder, type FolderScope } from './api';
import { songListLoader, type SongListParams } from './songListLoader';
import type { LibraryFilter, LibrarySort } from './LibraryToolbar';

/** The library screen's data: the song list with its search/sort/filter, the folder rail and
 * its scope, and the loaders that re-read them from the server. */
export function useLibraryData() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<LibrarySort>('newest');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderScope, setFolderScope] = useState<FolderScope>(() => localStorage.getItem('folderScope') ?? null);
  const [totalSongCount, setTotalSongCount] = useState(0);
  const activeFolder = folders.find((f) => f.id === folderScope) ?? null;
  const unfiledCount = Math.max(0, totalSongCount - folders.reduce((sum, f) => sum + f.song_count, 0));

  // Read by the loader when a request fires, so every refresh sends this render's query and folder.
  const params = useRef<SongListParams>({ query, scope: folderScope });
  params.current = { query, scope: folderScope };
  const loader = useMemo(() => songListLoader(api.listSongs, setSongs, () => params.current), []);
  useEffect(() => loader.dispose, [loader]);
  const { refresh } = loader;
  const search = (text: string) => { setQuery(text); loader.search(); };
  const refreshFolders = () => {
    api.listFolders().then(setFolders).catch(() => {});
    api.libraryStats().then((s) => setTotalSongCount(s.songCount)).catch(() => {});
  };

  const createFolder = (name: string) => api.createFolder(name).then(refreshFolders);

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

  return {
    songs, query, search, sort, setSort, filter, setFilter,
    folders, folderScope, setFolderScope, totalSongCount, activeFolder, unfiledCount,
    refresh, refreshFolders, createFolder, visibleSongs,
  };
}

export type LibraryData = ReturnType<typeof useLibraryData>;
