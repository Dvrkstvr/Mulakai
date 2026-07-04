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
  prompt: string;
  task_type: string;
  region_start: number | null;
  region_end: number | null;
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

export type StemKind = 'vocals' | 'drums' | 'bass' | 'other';

export interface StemResult {
  kind: StemKind;
  status: 'running' | 'done' | 'failed';
  audioFile?: string;
  error?: string;
  claimed?: 'replaced' | 'added';
}

export interface RefineResult {
  caption: string;
  lyrics: string;
  bpm?: number;
  key_scale?: string;
  time_signature?: string;
  duration?: number;
  vocal_language?: string;
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

  refineInput: (params: { prompt: string; lyrics: string } & Record<string, unknown>): Promise<RefineResult> =>
    fetch('/api/generate/format', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).then((r) => json<RefineResult>(r)),

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

  deleteVersion: (versionId: string): Promise<void> =>
    fetch(`/api/layers/versions/${versionId}`, { method: 'DELETE' }).then((r) => json(r)),

  regenerateVersion: (versionId: string): Promise<{ jobId: string }> =>
    fetch(`/api/layers/versions/${versionId}/regenerate`, { method: 'POST' }).then((r) => json<{ jobId: string }>(r)),

  retakeVersion: (versionId: string): Promise<{ jobId: string }> =>
    fetch(`/api/layers/versions/${versionId}/retake`, { method: 'POST' }).then((r) => json<{ jobId: string }>(r)),

  addLayer: (
    songId: string,
    mixAudio: Blob,
    params: { prompt: string; layerName: string } & Record<string, unknown>,
  ): Promise<{ jobId: string }> => {
    const form = new FormData();
    form.append('mix_audio', mixAudio, 'mix.wav');
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) form.append(k, String(v));
    }
    // No explicit Content-Type: the browser sets the multipart boundary itself.
    return fetch(`/api/songs/${songId}/layers`, { method: 'POST', body: form })
      .then((r) => json<{ jobId: string }>(r));
  },

  updateLayer: (
    layerId: string,
    patch: { name?: string; volume?: number; muted?: boolean; solo?: boolean },
  ): Promise<void> =>
    fetch(`/api/layers/${layerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((r) => json(r)),

  deleteLayer: (layerId: string): Promise<void> =>
    fetch(`/api/layers/${layerId}`, { method: 'DELETE' }).then((r) => json(r)),

  trash: (id: string): Promise<void> =>
    fetch(`/api/songs/${id}/trash`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then(() => undefined),

  startSplit: (layerId: string, model: 'acestep' | 'demucs'): Promise<{ jobId: string }> =>
    fetch(`/api/layers/${layerId}/split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    }).then((r) => json<{ jobId: string }>(r)),

  splitStatus: (jobId: string): Promise<{ status: 'running' | 'done'; stems: StemResult[] }> =>
    fetch(`/api/split/${jobId}`).then((r) => json(r)),

  splitHealth: (): Promise<{ acestep: boolean; demucs: boolean }> =>
    fetch('/api/split/health').then((r) => json(r)),

  claimStem: (jobId: string, kind: StemKind, action: 'replace' | 'add-layer'): Promise<{ songId: string }> =>
    fetch(`/api/split/${jobId}/stems/${kind}/${action}`, { method: 'POST' }).then((r) => json(r)),

  reextractStem: (jobId: string, kind: StemKind): Promise<StemResult> =>
    fetch(`/api/split/${jobId}/stems/${kind}/reextract`, { method: 'POST' }).then((r) => json(r)),

  cancelSplit: (jobId: string): Promise<void> =>
    fetch(`/api/split/${jobId}/cancel`, { method: 'POST' }).then(() => undefined),
};
