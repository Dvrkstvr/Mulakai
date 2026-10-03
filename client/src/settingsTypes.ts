import type { AudioFormat, SampleRate, BitDepth, Mp3Bitrate } from './formatCaps';
import type { Quality } from './qualitySteps';

export interface GenSettings {
  model: string; // '' = server default
  lmModel: string; // '' = server default
  thinking: boolean;
  useFormat: boolean; // AI enhance (LLM caption/lyrics)
  /** Create's QUALITY chip; steps resolve from it at submit unless it is `custom`. */
  quality: Quality;
  inferenceSteps: number; // read only while quality is 'custom'
  guidanceScale: number;
  randomSeed: boolean;
  seed: number;
  batchSize: number; // 0 = AUTO (ACE-Step defaults to 2 server-side when omitted)
  shift: number; // 0 = AUTO
  inferMethod: '' | 'ode' | 'sde'; // '' = AUTO
  timesteps: string; // '' = unset; overrides inferenceSteps and shift when set
  useAdg: boolean;
  cfgIntervalStart: number;
  cfgIntervalEnd: number;
  lmTemperature: number;
  lmCfgScale: number;
  lmNegativePrompt: string; // '' = server default ("NO USER INPUT")
  lmTopK: number; // 0 = disabled
  lmTopP: number;
  lmRepetitionPenalty: number;
}

/** The advanced DiT/LM knobs edited by AdvancedGenSettings. Shared by GenSettings
 * (structurally — it already carries every field) and RepaintSettings, so one
 * panel can drive both Repaint and Add Layer (universal settings). */
export interface AdvancedSettings {
  shift: number; // 0 = AUTO
  inferMethod: '' | 'ode' | 'sde'; // '' = AUTO
  timesteps: string; // '' = unset; overrides inferenceSteps and shift when set
  useAdg: boolean;
  cfgIntervalStart: number;
  cfgIntervalEnd: number;
  lmTemperature: number;
  lmCfgScale: number;
  lmNegativePrompt: string; // '' = server default ("NO USER INPUT")
  lmTopK: number; // 0 = disabled
  lmTopP: number;
  lmRepetitionPenalty: number;
}

export interface RepaintSettings extends AdvancedSettings {
  model: string; // '' = server default.
  repaintStrength: number; // VARIANCE 0-1; inverse of audio_cover_strength
  inferenceSteps: number;
  guidanceScale: number;
  randomSeed: boolean;
  seed: number;
  /** Waveform-level splice crossfade at the repaint region boundary, seconds. 0 = hard cut (ACE-Step's own default). */
  crossfadeSec: number;
  // NB: the advanced DiT knobs (shift/adg/cfg-interval) are Base-model only and
  // the LM knobs only apply to Add Layer (repaint skips the LM,
  // docs/ace-step-1.5/API.md#4.2) — repaintParams therefore emits only the DiT
  // subset, addLayerParams emits both. The values live here once, shared.
}

export interface AddLayerSettings {
  model: string; // '' = server default. Must be lego-capable (Base model) — client filters options.
  // Steps/guidance/seed and all advanced knobs are shared with RepaintSettings
  // (see addLayerParams) rather than duplicated — Add Layer is another ACE-Step
  // conditioning op on the same song. Only `model` is Add-Layer-specific.
}

export type { AudioFormat, SampleRate, BitDepth, Mp3Bitrate } from './formatCaps';

export interface ExportSettings {
  audioFormat: AudioFormat;
  /** Container sample rate. 48k is ACE-Step's native rate (so the default is a
   * no-op there); 44.1k exists for CD/distribution targets and costs a resample. */
  sampleRate: SampleRate;
  /** Clamped to what `audioFormat` can hold — FLAC has no 32-bit float. */
  bitDepth: BitDepth;
  /** mp3 only; ignored by wav/flac. */
  mp3Bitrate: Mp3Bitrate;
  /** Remaster diffusion steps, 1-200 (ACE-Step's documented Base-model ceiling). */
  steps: number;
  /** Default playback volume (0-1) applied once when a Player first mounts. */
  volume: number;
}

export interface SettingsState {
  gen: GenSettings;
  repaint: RepaintSettings;
  addLayer: AddLayerSettings;
  exportSettings: ExportSettings;
  /** Reveals FORGE's header icon (docs FORGE_PLAN.md) — the screen behind it is a stub until release 1.0. */
  forgeEnabled: boolean;
  setGen: (patch: Partial<GenSettings>) => void;
  setRepaint: (patch: Partial<RepaintSettings>) => void;
  setAddLayer: (patch: Partial<AddLayerSettings>) => void;
  setExportSettings: (patch: Partial<ExportSettings>) => void;
  setForgeEnabled: (v: boolean) => void;
}
