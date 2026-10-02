import { describe, it, expect, vi } from 'vitest';
import type { SongDetail } from './api';
import { songReloader } from './useSongDetail';

const song = { id: 's1', title: 'Copper Sky' } as SongDetail;

describe('songReloader', () => {
  it('sets the song and clears a previous error on success', async () => {
    const setSong = vi.fn();
    const setLoadError = vi.fn();
    await songReloader(() => Promise.resolve(song), setSong, setLoadError)();
    expect(setSong).toHaveBeenCalledWith(song);
    expect(setLoadError).toHaveBeenCalledWith('');
  });

  it('reports a failed load instead of rejecting, and leaves the song alone', async () => {
    const setSong = vi.fn();
    const setLoadError = vi.fn();
    const reload = songReloader(() => Promise.reject(new TypeError('Failed to fetch')), setSong, setLoadError);
    await expect(reload()).resolves.toBeUndefined();
    expect(setSong).not.toHaveBeenCalled();
    expect(setLoadError).toHaveBeenCalledWith('Failed to fetch');
  });

  it('clears the error once a retry succeeds', async () => {
    const setLoadError = vi.fn();
    const load = vi.fn().mockRejectedValueOnce(new Error('HTTP 500')).mockResolvedValueOnce(song);
    const reload = songReloader(load, vi.fn(), setLoadError);
    await reload();
    await reload();
    expect(setLoadError.mock.calls).toEqual([['HTTP 500'], ['']]);
  });
});
