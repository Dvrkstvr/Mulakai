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

export type TaskType = 'text2music' | 'repaint' | 'cover' | 'cover-nofsq' | 'lego' | 'extract' | 'complete';

export interface ModelInfo {
  name: string;
  supportedTaskTypes: TaskType[];
}

export interface ModelInventory {
  models: ModelInfo[]; // DiT models
  lmModels: string[]; // 5Hz LM models
  defaultModel: string | null;
}

export interface Version {
  id: string;
  audio_file: string;
  label: string;
  seed: string;
  active: 0 | 1;
  created_at: string;
}

export interface Layer {
  id: string;
  name: string;
  kind: string;
  position: number;
  region_start: number;
  region_end: number | null;
  volume: number;
  muted: 0 | 1;
  solo: 0 | 1;
  versions: Version[];
}

export interface SongDetail extends Song {
  layers: Layer[];
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

  generate: (params: { title: string; prompt: string; lyrics?: string } & Record<string, unknown>): Promise<{ jobId: string }> =>
    fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).then((r) => json<{ jobId: string }>(r)),

  listModels: (): Promise<ModelInventory> =>
    fetch('/api/generate/models').then((r) => json<ModelInventory>(r)),

  jobStatus: (jobId: string): Promise<{ status: 'loading' | 'running' | 'done' | 'failed'; songId?: string; error?: string }> =>
    fetch(`/api/generate/${jobId}`).then((r) => json(r)),

  acestepHealth: (): Promise<{ acestep: boolean }> =>
    fetch('/api/generate/health').then((r) => json(r)),

  setFavorite: (id: string, favorite: boolean): Promise<void> =>
    fetch(`/api/songs/${id}/favorite`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite }),
    }).then(() => undefined),

  songDetail: (id: string): Promise<SongDetail> =>
    fetch(`/api/songs/${id}`).then((r) => json<SongDetail>(r)),

  repaint: (
    layerId: string,
    params: { prompt: string; start: number; end: number } & Record<string, unknown>,
  ): Promise<{ jobId: string }> =>
    fetch(`/api/layers/${layerId}/repaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).then((r) => json<{ jobId: string }>(r)),

  activateVersion: (versionId: string): Promise<void> =>
    fetch(`/api/layers/versions/${versionId}/activate`, { method: 'PATCH' }).then(() => undefined),

  trash: (id: string): Promise<void> =>
    fetch(`/api/songs/${id}/trash`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then(() => undefined),
};
