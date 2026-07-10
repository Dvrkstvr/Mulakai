export interface Song {
  id: string;
  title: string;
  caption: string;
  lyrics: string;
  bpm: number | null;
  key_scale: string;
  time_signature: string;
  duration: number | null;
  favorite: 0 | 1;
  audio_file: string | null;
  trashed_at: string | null;
  created_at: string;
  comment: string;
  genre: string;
  album: string;
  cover_art_file: string | null;
  folder_id: string | null;
  /** The reference audio that conditioned the generation, if any (voice name or clip filename).
   * Influences are populated for text2music only — cover/complete leave them null. */
  reference_audio_label: string | null;
  reference_audio_influence: number | null;
  reference_style_influence: number | null;
}

export interface Folder {
  id: string;
  name: string;
  position: number;
  created_at: string;
  song_count: number;
}

/** The Library's folder scope — a real folder id, `'unfiled'` (no folder), or `null` for
 * All Songs (no filter at all). Passed straight through to `api.listSongs`'s folder param. */
export type FolderScope = string | 'unfiled' | null;

export interface LyricTag {
  tag: string;
  kind: 'section' | 'inline';
  count: number;
}

export interface LyricTagProbeStatus {
  running: boolean;
  completed: number;
  lastRunAt: string | null;
  lastError: string | null;
}

export interface OutputMetadata {
  artist: string;
  encoder: string;
  id3Version: '3' | '4';
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

/** One aligned lyric line for this render: seconds-scaled start/end plus its (possibly bracket-tagged) text. */
export interface LyricLine {
  start: number;
  end: number;
  text: string;
  confidence?: number;
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
  lyricTimestamps: LyricLine[] | null;
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

/** Mirrors server/src/services/genLock.ts's GenLockInfo, joined with the underlying job's status. */
export interface ActiveGeneration {
  kind: 'generate' | 'repaint' | 'regenerate' | 'retake' | 'addLayer' | 'split' | 'remaster';
  jobId: string;
  songId?: string;
  title?: string;
  caption?: string;
  startedAt: number;
  status: 'loading' | 'running' | 'done' | 'failed';
  error?: string;
}

export interface Voice {
  id: string;
  name: string;
  audio_file: string;
  duration: number | null;
  tags: string;
  default_audio_influence: number;
  default_style_influence: number;
  created_at: string;
}

/** Thrown by `json()` for a non-OK response, carrying the HTTP status so callers can tell
 * "this job/lock is gone" (404 — e.g. aborted from the header's status pill, see
 * editorJobStore.ts's startSplit poll) apart from a transient network/server error. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError((body as { error?: string }).error ?? `HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listSongs: (q = '', folder?: FolderScope): Promise<Song[]> =>
    fetch(`/api/songs?q=${encodeURIComponent(q)}${folder ? `&folder=${encodeURIComponent(folder)}` : ''}`)
      .then((r) => json<Song[]>(r)),

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

  /** Plain JSON unless an ad-hoc reference-audio file is attached (see ReferenceAudioPicker.tsx),
   * in which case it switches to multipart — the server's `/` route accepts both. */
  generate: (
    params: { title: string; prompt: string; lyrics?: string } & Record<string, unknown>,
    referenceAudio?: Blob,
  ): Promise<{ jobId: string }> => {
    if (!referenceAudio) {
      return fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }).then((r) => json<{ jobId: string }>(r));
    }
    const form = new FormData();
    form.append('reference_audio', referenceAudio, 'reference.wav');
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) form.append(k, String(v));
    }
    return fetch('/api/generate', { method: 'POST', body: form }).then((r) => json<{ jobId: string }>(r));
  },

  listModels: (): Promise<ModelInventory> =>
    fetch('/api/generate/models').then((r) => json<ModelInventory>(r)),

  generateFromAudio: (
    srcAudio: Blob,
    params: { title: string; prompt: string; lyrics?: string } & Record<string, unknown>,
    referenceAudio?: Blob,
  ): Promise<{ jobId: string }> => {
    const form = new FormData();
    form.append('src_audio', srcAudio, 'source.wav');
    if (referenceAudio) form.append('reference_audio', referenceAudio, 'reference.wav');
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) form.append(k, String(v));
    }
    return fetch('/api/generate/from-audio', { method: 'POST', body: form })
      .then((r) => json<{ jobId: string }>(r));
  },

  refineInput: (params: { prompt: string; lyrics: string } & Record<string, unknown>): Promise<RefineResult> =>
    fetch('/api/generate/format', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).then((r) => json<RefineResult>(r)),

  randomSample: (sampleType: 'simple_mode' | 'custom_mode' = 'custom_mode'): Promise<RefineResult> =>
    fetch('/api/generate/random-sample', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sample_type: sampleType }),
    }).then((r) => json<RefineResult>(r)),

  sampleFromQuery: (query: string): Promise<RefineResult> =>
    fetch('/api/generate/sample-from-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }).then((r) => json<RefineResult>(r)),

  jobStatus: (jobId: string): Promise<{
    status: 'loading' | 'running' | 'done' | 'failed'; songId?: string; error?: string;
    progress?: number; progressStage?: string; progressText?: string;
  }> =>
    fetch(`/api/generate/${jobId}`).then((r) => json(r)),

  /** The server-wide generation lock, if any — used to rehydrate the library's
   * "generating" card after a page refresh mid-generation. */
  activeGeneration: (): Promise<{ active: ActiveGeneration | null }> =>
    fetch('/api/generate/active').then((r) => json(r)),

  /** Dev convenience: force-stop whatever currently holds the generation lock
   * (any kind, including a Demucs/ACE-Step split) — see Header's status pill. */
  abortActive: (): Promise<{ ok: boolean; aborted: boolean }> =>
    fetch('/api/generate/active/abort', { method: 'POST' }).then((r) => json(r)),

  acestepHealth: (): Promise<{ acestep: boolean }> =>
    fetch('/api/generate/health').then((r) => json(r)),

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

  remaster: (
    songId: string,
    mixAudio: Blob,
    model: string,
    opts: { audioFormat: string; steps: number },
  ): Promise<{ jobId: string }> => {
    const form = new FormData();
    form.append('mix_audio', mixAudio, 'mix.wav');
    form.append('model', model);
    form.append('audio_format', opts.audioFormat);
    form.append('steps', String(opts.steps));
    return fetch(`/api/songs/${songId}/remaster`, { method: 'POST', body: form })
      .then((r) => json<{ jobId: string }>(r));
  },

  remasterDownloadUrl: (songId: string, jobId: string): string =>
    `/api/songs/${songId}/remaster/${jobId}/download`,

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

  /** Standalone stem split: upload any audio file, no song/library entry created — usable on
   * its own (download the stems) or to pick a source track for Complete generation. */
  splitScratch: (file: Blob, model: 'acestep' | 'demucs'): Promise<{ jobId: string }> => {
    const form = new FormData();
    form.append('audio', file, 'source.wav');
    form.append('model', model);
    return fetch('/api/split/scratch', { method: 'POST', body: form }).then((r) => json<{ jobId: string }>(r));
  },

  scratchSplitStatus: (jobId: string): Promise<{ status: 'running' | 'done'; stems: StemResult[] }> =>
    fetch(`/api/split/scratch/${jobId}`).then((r) => json(r)),

  scratchStemDownloadUrl: (jobId: string, kind: StemKind): string =>
    `/api/split/scratch/${jobId}/${kind}/download`,

  discardScratchSplit: (jobId: string): Promise<void> =>
    fetch(`/api/split/scratch/${jobId}/discard`, { method: 'POST' }).then(() => undefined),

  /** "Complete": generate a full accompaniment around a single bare source track. Source is
   * either a direct upload/library-bounced file, or a reference into an already-run scratch
   * split job's stem (avoids re-downloading+re-uploading a stem produced server-side). */
  generateComplete: (
    source: { file: Blob } | { scratchJobId: string; scratchStemKind: StemKind },
    params: { title: string; prompt?: string } & Record<string, unknown>,
    referenceAudio?: Blob,
  ): Promise<{ jobId: string }> => {
    const form = new FormData();
    if ('file' in source) {
      form.append('src_audio', source.file, 'source.wav');
    } else {
      form.append('scratch_job_id', source.scratchJobId);
      form.append('scratch_stem_kind', source.scratchStemKind);
    }
    if (referenceAudio) form.append('reference_audio', referenceAudio, 'reference.wav');
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) form.append(k, String(v));
    }
    return fetch('/api/generate/complete', { method: 'POST', body: form }).then((r) => json<{ jobId: string }>(r));
  },

  /** "Describe this audio for me" — ACE-Step's `/v1/analyze_audio`, same dual-source shape
   * as `generateComplete`'s source param (a direct upload, or a reference into an already-run
   * scratch split job's stem). Returns the same caption/lyrics/metadata shape as `refineInput`. */
  analyzeSourceAudio: (source: { file: Blob } | { scratchJobId: string; scratchStemKind: StemKind }): Promise<RefineResult> => {
    const form = new FormData();
    if ('file' in source) {
      form.append('src_audio', source.file, 'source.wav');
    } else {
      form.append('scratch_job_id', source.scratchJobId);
      form.append('scratch_stem_kind', source.scratchStemKind);
    }
    return fetch('/api/generate/analyze-audio', { method: 'POST', body: form }).then((r) => json<RefineResult>(r));
  },

  listVoices: (): Promise<Voice[]> => fetch('/api/voices').then((r) => json<Voice[]>(r)),

  uploadVoice: (
    name: string,
    audio: Blob,
    meta: { duration?: number; tags?: string } & Record<string, unknown> = {},
  ): Promise<Voice> => {
    const form = new FormData();
    form.append('name', name);
    form.append('audio', audio, 'voice.mp3');
    for (const [k, v] of Object.entries(meta)) {
      if (v !== undefined && v !== null) form.append(k, String(v));
    }
    return fetch('/api/voices', { method: 'POST', body: form }).then((r) => json<Voice>(r));
  },

  updateVoice: (
    id: string,
    patch: { name?: string; tags?: string; default_audio_influence?: number; default_style_influence?: number },
  ): Promise<Voice> =>
    fetch(`/api/voices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((r) => json<Voice>(r)),

  deleteVoice: (id: string): Promise<void> =>
    fetch(`/api/voices/${id}`, { method: 'DELETE' }).then((r) => json(r)),

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

  listLyricTags: (): Promise<LyricTag[]> =>
    fetch('/api/lyric-tags').then((r) => json<{ tags: LyricTag[] }>(r)).then((d) => d.tags),

  getLyricTagProbeStatus: (): Promise<LyricTagProbeStatus> =>
    fetch('/api/lyric-tags/status').then((r) => json<LyricTagProbeStatus>(r)),

  probeLyricTags: (): Promise<{ status: string }> =>
    fetch('/api/lyric-tags/probe', { method: 'POST' }).then((r) => json<{ status: string }>(r)),

  stopLyricTagProbe: (): Promise<{ status: string }> =>
    fetch('/api/lyric-tags/probe/stop', { method: 'POST' }).then((r) => json<{ status: string }>(r)),

  getOutputMetadata: (): Promise<OutputMetadata> =>
    fetch('/api/output-metadata').then((r) => json<OutputMetadata>(r)),

  updateOutputMetadata: (
    patch: Partial<Pick<OutputMetadata, 'artist' | 'encoder' | 'id3Version'>>,
  ): Promise<OutputMetadata> =>
    fetch('/api/output-metadata', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((r) => json<OutputMetadata>(r)),
};
