/** Wire types shared by the ACE-Step client slices (see ../acestep.ts). */
import type { OutputSettings } from '../audioOutput.js';

export type TaskType = 'text2music' | 'repaint' | 'cover' | 'lego' | 'extract' | 'complete';

export interface ReleaseTaskParams {
  /** The user's output format/rate/depth. Never sent to ACE-Step (stripped in
   * releaseTask) — it travels here so every job path already carrying params
   * can reach transcode.ts without a parallel plumbing channel. */
  output?: OutputSettings;
  /** Which adapter was loaded when this ran. Also ours, not ACE-Step's (stripped in the same
   * place as `output`): adapters are server state, not a request field, so the only way a
   * finished take can say what coloured it is for ensureModelLoaded to stamp it here on the
   * way past — every persist path already records these params into versions.params_json. */
  adapter?: { name: string; scale: number };
  prompt?: string;
  lyrics?: string;
  thinking?: boolean;
  sample_query?: string;
  use_format?: boolean;
  use_cot_caption?: boolean;
  use_cot_language?: boolean;
  model?: string;
  lm_model_path?: string;
  bpm?: number;
  key_scale?: string;
  time_signature?: string;
  vocal_language?: string;
  audio_duration?: number;
  inference_steps?: number;
  guidance_scale?: number;
  use_random_seed?: boolean;
  seed?: number;
  batch_size?: number;
  task_type?: TaskType;
  instruction?: string;
  /** lego/extract/complete only — templates ACE-Step's own instruction string server-side
   * (acestep/constants.py's TRACK_NAMES); independent of the free-text prompt field. */
  track_name?: string;
  repainting_start?: number;
  repainting_end?: number;
  audio_cover_strength?: number;
  /** Waveform-level splice crossfade at the repaint region boundary, in seconds. 0 = hard cut (default). */
  repaint_wav_crossfade_sec?: number;
  audio_format?: string;
  /** Anchor seed for variance-preserving noise mixing; only consumed when retake_variance > 0. */
  retake_seed?: string;
  /** 0 = no-op (default); 0.05-0.15 subtle variation; 0.5+ strong departure. */
  retake_variance?: number;
  /** Timestep shift factor, 1.0-5.0. Only effective for base models, not turbo. */
  shift?: number;
  infer_method?: 'ode' | 'sde';
  /** Comma-separated custom timesteps; overrides inference_steps and shift when set. */
  timesteps?: string;
  /** Adaptive Dual Guidance — base model only. */
  use_adg?: boolean;
  cfg_interval_start?: number;
  cfg_interval_end?: number;
  lm_temperature?: number;
  lm_cfg_scale?: number;
  lm_negative_prompt?: string;
  /** 0/undefined disables. */
  lm_top_k?: number;
  /** >=1 is treated as disabled. */
  lm_top_p?: number;
  lm_repetition_penalty?: number;
}

export interface FormatInputParams {
  prompt?: string;
  lyrics?: string;
  temperature?: number;
  bpm?: number;
  key_scale?: string;
  time_signature?: string;
  vocal_language?: string;
  audio_duration?: number;
}

export interface FormatInputResult {
  caption: string;
  lyrics: string;
  bpm?: number;
  key_scale?: string;
  time_signature?: string;
  duration?: number;
  vocal_language?: string;
}

export interface SampleResult {
  caption: string;
  lyrics: string;
  bpm?: number;
  key_scale?: string;
  time_signature?: string;
  duration?: number;
  vocal_language?: string;
}

export interface TaskResult {
  file: string; // /v1/audio?path=... url
  status: 0 | 1 | 2;
  prompt: string;
  lyrics: string;
  metas: { bpm?: number; duration?: number; keyscale?: string; timesignature?: string };
  seed_value: string;
  dit_model?: string;
  /** 0.0-1.0, fed from ACE-Step's diffusion-loop callback; only meaningful while status is still running. */
  progress?: number;
  /** Free-text label from ACE-Step (e.g. "running"); raw wire field, not Mulakai's own Job.status lifecycle. */
  stage?: string;
}

/** One aligned lyric line: seconds-scaled start/end plus its (possibly bracket-tagged) text. */
export interface SentenceTimestamp {
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface LyricTimestampResult {
  lrc_text: string;
  sentence_timestamps: SentenceTimestamp[];
  success: boolean;
  error: string | null;
}
