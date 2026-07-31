/** Library slice: songs, folders, trash, per-song metadata/cover art. */
import { json } from './http';
import type { Song, SongDetail, Folder, FolderScope } from './types';

export const libraryApi = {
  listSongs: (q = '', folder?: FolderScope): Promise<Song[]> =>
    fetch(`/api/songs?q=${encodeURIComponent(q)}${folder ? `&folder=${encodeURIComponent(folder)}` : ''}`)
      .then((r) => json<Song[]>(r)),

  /** Adds an existing audio file to the library as a song, with no generation involved —
   * the file itself becomes the base layer's first version, so it can be repainted and
   * layered like a generated song. `fields` comes from songImport.ts's importFields; the
   * File's own name carries the extension (the server allowlists it) and is the title
   * fallback, so it is deliberately not overridden here. */
  importSong: (audio: File, fields: Record<string, string> = {}): Promise<Song> => {
    const form = new FormData();
    form.append('audio', audio);
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    return fetch('/api/songs/import', { method: 'POST', body: form }).then((r) => json<Song>(r));
  },

  listFolders: (): Promise<Folder[]> => fetch('/api/folders').then((r) => json<Folder[]>(r)),

  createFolder: (name: string): Promise<Folder> =>
    fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then((r) => json<Folder>(r)),

  renameFolder: (id: string, name: string): Promise<void> =>
    fetch(`/api/folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then(() => undefined),

  deleteFolder: (id: string): Promise<void> =>
    fetch(`/api/folders/${id}`, { method: 'DELETE' }).then(() => undefined),

  nextFolderTitle: (id: string): Promise<{ title: string }> =>
    fetch(`/api/folders/${id}/next-title`).then((r) => json<{ title: string }>(r)),

  moveSongToFolder: (songId: string, folderId: string | null): Promise<void> =>
    fetch(`/api/songs/${songId}/folder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folderId }),
    }).then(() => undefined),

  setFavorite: (id: string, favorite: boolean): Promise<void> =>
    fetch(`/api/songs/${id}/favorite`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite }),
    }).then(() => undefined),

  renameSong: (id: string, title: string): Promise<void> =>
    fetch(`/api/songs/${id}/title`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }).then(() => undefined),

  songDetail: (id: string): Promise<SongDetail> =>
    fetch(`/api/songs/${id}`).then((r) => json<SongDetail>(r)),

  trash: (id: string, restore = false): Promise<void> =>
    fetch(`/api/songs/${id}/trash`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restore }),
    }).then(() => undefined),

  listTrash: (): Promise<Song[]> => fetch('/api/songs/trash').then((r) => json<Song[]>(r)),

  emptyTrash: (): Promise<void> => fetch('/api/songs/trash', { method: 'DELETE' }).then(() => undefined),

  libraryStats: (): Promise<{ storageBytes: number; songCount: number; trashCount: number }> =>
    fetch('/api/songs/stats').then((r) => json(r)),

  updateSongMetadata: (id: string, patch: { genre?: string; album?: string; comment?: string }): Promise<void> =>
    fetch(`/api/songs/${id}/metadata`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(() => undefined),

  uploadSongCoverArt: (id: string, image: Blob): Promise<{ coverArtFile: string }> => {
    const form = new FormData();
    form.append('image', image, 'cover.png');
    return fetch(`/api/songs/${id}/cover-art`, { method: 'POST', body: form }).then((r) => json(r));
  },

  deleteSongCoverArt: (id: string): Promise<void> =>
    fetch(`/api/songs/${id}/cover-art`, { method: 'DELETE' }).then(() => undefined),
};
