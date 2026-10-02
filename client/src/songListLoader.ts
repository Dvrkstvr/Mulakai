import type { FolderScope, Song } from './api';

export const SEARCH_DEBOUNCE_MS = 250;

export interface SongListParams {
  query: string;
  scope: FolderScope;
}

/**
 * Loads the Library's song list so the newest request always wins: each load is
 * numbered, and a response is applied only if no newer load has started since — a
 * slow response for "co" can't replace the results for "copper". `params` is read
 * when a load fires, not when it's queued, so a refresh scheduled from an old
 * render (after a favorite toggle, say) still sends the current query and folder.
 */
export function songListLoader(
  load: (query: string, scope: FolderScope) => Promise<Song[]>,
  apply: (songs: Song[]) => void,
  params: () => SongListParams,
) {
  let latest = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancelSearch = () => {
    if (timer !== null) { clearTimeout(timer); timer = null; }
  };

  /** Loads now. Cancels a pending search, which would read these same params.
   * Resolves to the list it applied, or null if a newer load superseded it or it failed. */
  const refresh = (): Promise<Song[] | null> => {
    cancelSearch();
    const id = ++latest;
    const { query, scope } = params();
    return load(query, scope).then(
      (songs) => {
        if (id !== latest) return null;
        apply(songs);
        return songs;
      },
      // A failed load leaves the list as it was (unchanged from before this loader).
      () => null,
    );
  };

  /** Loads once typing pauses: a burst of keystrokes becomes one request for the final text. */
  const search = () => {
    cancelSearch();
    timer = setTimeout(() => { timer = null; void refresh(); }, SEARCH_DEBOUNCE_MS);
  };

  return { refresh, search, dispose: cancelSearch };
}
