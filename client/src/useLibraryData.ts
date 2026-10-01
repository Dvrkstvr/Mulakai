import { useMemo, useState } from 'react';
import { api, type Song, type Folder, type FolderScope } from './api';
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

  const refresh = (q = query, scope = folderScope) => api.listSongs(q, scope).then(setSongs).catch(() => {});
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
    songs, setSongs, query, setQuery, sort, setSort, filter, setFilter,
    folders, folderScope, setFolderScope, totalSongCount, activeFolder, unfiledCount,
    refresh, refreshFolders, createFolder, visibleSongs,
  };
}

export type LibraryData = ReturnType<typeof useLibraryData>;
