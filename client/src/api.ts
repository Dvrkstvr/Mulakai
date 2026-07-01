export interface Song {
  id: string;
  title: string;
  caption: string;
  lyrics: string;
  bpm: number | null;
  key_scale: string;
  duration: number | null;
  favorite: 0 | 1;
  audio_file: string | null;
  created_at: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listSongs: (q = ''): Promise<Song[]> =>
    fetch(`/api/songs?q=${encodeURIComponent(q)}`).then((r) => json<Song[]>(r)),

  generate: (params: { title: string; prompt: string; lyrics?: string }): Promise<{ jobId: string }> =>
    fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).then((r) => json<{ jobId: string }>(r)),

  jobStatus: (jobId: string): Promise<{ status: 'running' | 'done' | 'failed'; songId?: string; error?: string }> =>
    fetch(`/api/generate/${jobId}`).then((r) => json(r)),

  acestepHealth: (): Promise<{ acestep: boolean }> =>
    fetch('/api/generate/health').then((r) => json(r)),

  setFavorite: (id: string, favorite: boolean): Promise<void> =>
    fetch(`/api/songs/${id}/favorite`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite }),
    }).then(() => undefined),

  trash: (id: string): Promise<void> =>
    fetch(`/api/songs/${id}/trash`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then(() => undefined),
};
