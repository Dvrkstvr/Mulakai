import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FolderScope, Song } from './api';
import { songListLoader, SEARCH_DEBOUNCE_MS, type SongListParams } from './songListLoader';

const song = (title: string) => ({ id: title, title }) as Song;

/** A load whose calls each wait for the test to resolve them, in any order. */
function controlledLoad() {
  const calls: { query: string; scope: FolderScope; resolve: (songs: Song[]) => void; reject: (e: Error) => void }[] = [];
  const load = vi.fn((query: string, scope: FolderScope) =>
    new Promise<Song[]>((resolve, reject) => { calls.push({ query, scope, resolve, reject }); }));
  return { calls, load };
}

describe('songListLoader', () => {
  let params: SongListParams;
  beforeEach(() => {
    vi.useFakeTimers();
    params = { query: '', scope: null };
  });
  afterEach(() => vi.useRealTimers());

  it('drops an older response that lands after a newer one', async () => {
    const { calls, load } = controlledLoad();
    const apply = vi.fn();
    const loader = songListLoader(load, apply, () => params);
    params.query = 'co';
    const older = loader.refresh();
    params.query = 'copper';
    const newer = loader.refresh();
    calls[1].resolve([song('Copper Sky')]);
    calls[0].resolve([song('Cobalt'), song('Copper Sky')]);
    await expect(newer).resolves.toEqual([song('Copper Sky')]);
    await expect(older).resolves.toBeNull();
    expect(apply.mock.calls).toEqual([[[song('Copper Sky')]]]);
  });

  it('collapses a burst of keystrokes into one request for the final text', async () => {
    const { calls, load } = controlledLoad();
    const loader = songListLoader(load, vi.fn(), () => params);
    for (const text of ['c', 'co', 'cop']) {
      params.query = text;
      loader.search();
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1);
    }
    expect(load).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(calls.map((c) => c.query)).toEqual(['cop']);
  });

  it('reads the query and folder when it fires, not when it is queued', async () => {
    const { calls, load } = controlledLoad();
    const loader = songListLoader(load, vi.fn(), () => params);
    params.query = 'cop';
    loader.search();
    params.query = 'copper';
    params.scope = 'folder-1';
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    expect(calls.map((c) => [c.query, c.scope])).toEqual([['copper', 'folder-1']]);
  });

  it('a refresh sends at once and cancels a pending search', async () => {
    const { calls, load } = controlledLoad();
    const loader = songListLoader(load, vi.fn(), () => params);
    params.query = 'copper';
    loader.search();
    void loader.refresh();
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS * 2);
    expect(calls.map((c) => c.query)).toEqual(['copper']);
  });

  it('dispose cancels a pending search', async () => {
    const { load } = controlledLoad();
    const loader = songListLoader(load, vi.fn(), () => params);
    loader.search();
    loader.dispose();
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS * 2);
    expect(load).not.toHaveBeenCalled();
  });

  it('a failed load leaves the list alone and resolves to null', async () => {
    const { calls, load } = controlledLoad();
    const apply = vi.fn();
    const loader = songListLoader(load, apply, () => params);
    const result = loader.refresh();
    calls[0].reject(new Error('HTTP 502'));
    await expect(result).resolves.toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });
});
