/** Wire types shared by the API client slices (see ./index.ts). */

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
  /** The ACE-Step task that created this song — `text2music` | `cover` | `complete`.
   * Null for songs generated before the column existed whose base-version params
   * didn't record one (see server/src/db/backfillGenTask.ts); treated as text2music. */
  gen_task: string | null;
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

/** A LoRA/LoKr adapter ACE-Step can load. `path` is on the ACE-Step host, not this browser's
 * machine — there is no upload here, and no endpoint to browse for one. */
export interface Adapter {
  id: string;
  name: string;
  path: string;
  kind: string;
  scale: number;
  createdAt: string;
}

export interface AdapterList {
  adapters: Adapter[];
  activeId: string | null;
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
  /** Only present for `generate` — which of the three song-creating tasks is running,
   * so a retry after a page refresh reopens Create on the right tab. */
  task?: string;
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
