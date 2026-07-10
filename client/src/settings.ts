import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GenSettings {
  model: string; // '' = server default
  lmModel: string; // '' = server default
  thinking: boolean;
  useFormat: boolean; // AI enhance (LLM caption/lyrics)
  inferenceSteps: number;
  guidanceScale: number;
  randomSeed: boolean;
  seed: number;
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

/** ACE-Step's documented output formats (docs/ace-step-1.5/API.md#4.2) — no bitrate/sample-rate
 * knob exists server-side, so those aren't modeled here (see Settings' Export section). */
export type AudioFormat = 'wav' | 'wav32' | 'flac' | 'mp3' | 'opus' | 'aac';

export interface ExportSettings {
  audioFormat: AudioFormat;
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

/**
 * Deep-merges a persisted (possibly stale) localStorage blob with the fresh default state.
 * Zustand persist's default merge is shallow at the top level, so a blob saved before a field
 * was added to `gen`/etc. (e.g. cfgIntervalStart/lmNegativePrompt) would wholesale replace that
 * slice and leave the new field undefined — genParams() then crashes calling .trim() on it.
 * Exported standalone so this can be unit-tested without simulating localStorage/persist wiring.
 */
export function mergeSettings(current: SettingsState, persisted: unknown): SettingsState {
  const p = (persisted ?? {}) as Partial<SettingsState>;
  return {
    ...current,
    ...p,
    gen: { ...current.gen, ...p.gen },
    repaint: { ...current.repaint, ...p.repaint },
    addLayer: { ...current.addLayer, ...p.addLayer },
    exportSettings: { ...current.exportSettings, ...p.exportSettings },
  };
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      gen: {
        model: '', // '' = AUTO (model's own default)
        lmModel: '', // '' = AUTO
        thinking: false,
        useFormat: false,
        inferenceSteps: 0, // 0 = AUTO
        guidanceScale: 0, // 0 = AUTO
        randomSeed: true,
        seed: 0,
        shift: 0, // 0 = AUTO
        inferMethod: '',
        timesteps: '',
        useAdg: false,
        cfgIntervalStart: 0,
        cfgIntervalEnd: 1,
        lmTemperature: 0.85,
        lmCfgScale: 2.5,
        lmNegativePrompt: '',
        lmTopK: 0,
        lmTopP: 0.9,
        lmRepetitionPenalty: 1,
      },
      repaint: {
        model: '', // '' = AUTO (model's own default)
        repaintStrength: 0.5,
        inferenceSteps: 0, // 0 = AUTO
        guidanceScale: 0, // 0 = AUTO
        randomSeed: true,
        seed: 0,
        crossfadeSec: 0, // 0 = hard cut (ACE-Step's own default)
        shift: 0, // 0 = AUTO
        inferMethod: '',
        timesteps: '',
        useAdg: false,
        cfgIntervalStart: 0,
        cfgIntervalEnd: 1,
        lmTemperature: 0.85,
        lmCfgScale: 2.5,
        lmNegativePrompt: '',
        lmTopK: 0,
        lmTopP: 0.9,
        lmRepetitionPenalty: 1,
      },
      addLayer: {
        model: '', // '' = AUTO — but AUTO isn't guaranteed lego-capable; UI requires an explicit pick.
      },
      exportSettings: {
        audioFormat: 'wav',
        steps: 100,
        volume: 1,
      },
      forgeEnabled: false,
      setGen: (patch) => set((s) => ({ gen: { ...s.gen, ...patch } })),
      setRepaint: (patch) => set((s) => ({ repaint: { ...s.repaint, ...patch } })),
      setAddLayer: (patch) => set((s) => ({ addLayer: { ...s.addLayer, ...patch } })),
      setExportSettings: (patch) => set((s) => ({ exportSettings: { ...s.exportSettings, ...patch } })),
      setForgeEnabled: (v) => set({ forgeEnabled: v }),
    }),
    {
      name: 'mulakai-settings',
      merge: (persisted, current) => mergeSettings(current, persisted),
    },
  ),
);

/** Map generation settings to ACE-Step request params. Empty/zero fields = AUTO (omitted). */
export function genParams(g: GenSettings) {
  return {
    audio_format: useSettings.getState().exportSettings.audioFormat,
    ...(g.model ? { model: g.model } : {}),
    ...(g.lmModel ? { lm_model_path: g.lmModel } : {}),
    thinking: g.thinking,
    use_format: g.useFormat,
    // Metadata auto-completion (bpm/key/time signature/duration) and caption/language
    // CoT rewriting are both LM-driven — gate them on AI ENHANCE so AUTO fields only
    // get enhanced when the user has actually opted into LM enhancement (the API
    // defaults these to `true` unconditionally, which would enhance silently).
    use_cot_caption: g.useFormat,
    use_cot_language: g.useFormat,
    ...(g.inferenceSteps > 0 ? { inference_steps: g.inferenceSteps } : {}),
    ...(g.guidanceScale > 0 ? { guidance_scale: g.guidanceScale } : {}),
    use_random_seed: g.randomSeed,
    ...(g.randomSeed ? {} : { seed: g.seed }),
    ...(g.shift > 0 ? { shift: g.shift } : {}),
    ...(g.inferMethod ? { infer_method: g.inferMethod } : {}),
    ...(g.timesteps.trim() ? { timesteps: g.timesteps.trim() } : {}),
    use_adg: g.useAdg,
    cfg_interval_start: g.cfgIntervalStart,
    cfg_interval_end: g.cfgIntervalEnd,
    lm_temperature: g.lmTemperature,
    lm_cfg_scale: g.lmCfgScale,
    ...(g.lmNegativePrompt.trim() ? { lm_negative_prompt: g.lmNegativePrompt.trim() } : {}),
    ...(g.lmTopK > 0 ? { lm_top_k: g.lmTopK } : {}),
    lm_top_p: g.lmTopP,
    lm_repetition_penalty: g.lmRepetitionPenalty,
  };
}

/** Advanced DiT knobs (Base-model only). Shared by repaint and Add Layer. */
function ditAdvancedParams(s: AdvancedSettings) {
  return {
    ...(s.shift > 0 ? { shift: s.shift } : {}),
    ...(s.inferMethod ? { infer_method: s.inferMethod } : {}),
    ...(s.timesteps.trim() ? { timesteps: s.timesteps.trim() } : {}),
    use_adg: s.useAdg,
    cfg_interval_start: s.cfgIntervalStart,
    cfg_interval_end: s.cfgIntervalEnd,
  };
}

/** 5Hz LM sampling knobs — only meaningful where the LM runs (text2music, lego,
 * complete), so repaint deliberately does not emit these. */
function lmAdvancedParams(s: AdvancedSettings) {
  return {
    lm_temperature: s.lmTemperature,
    lm_cfg_scale: s.lmCfgScale,
    ...(s.lmNegativePrompt.trim() ? { lm_negative_prompt: s.lmNegativePrompt.trim() } : {}),
    ...(s.lmTopK > 0 ? { lm_top_k: s.lmTopK } : {}),
    lm_top_p: s.lmTopP,
    lm_repetition_penalty: s.lmRepetitionPenalty,
  };
}

/**
 * Map repaint settings to ACE-Step request params (region added by caller).
 * `audio_cover_strength` (docs/ace-step-1.5/API.md#4.2) is the real knob:
 * higher = closer to source, lower = more freedom. VARIANCE is its inverse
 * so the slider reads "amount of change" the way the UI presents it. Emits the
 * DiT advanced knobs but not the LM ones (repaint skips the LM).
 */
export function repaintParams(r: RepaintSettings) {
  return {
    audio_format: useSettings.getState().exportSettings.audioFormat,
    ...(r.model ? { model: r.model } : {}),
    audio_cover_strength: 1 - r.repaintStrength,
    ...(r.inferenceSteps > 0 ? { inference_steps: r.inferenceSteps } : {}),
    ...(r.guidanceScale > 0 ? { guidance_scale: r.guidanceScale } : {}),
    use_random_seed: r.randomSeed,
    ...(r.randomSeed ? {} : { seed: r.seed }),
    repaint_wav_crossfade_sec: r.crossfadeSec,
    ...ditAdvancedParams(r),
  };
}

/**
 * Map Add Layer settings to ACE-Step request params. `model` is Add-Layer-specific
 * (lego needs a Base model); steps/guidance/seed and all advanced knobs are shared
 * with repaint — the same left-rail panel edits both. `lego` runs the LM, so unlike
 * repaint this also emits the LM knobs.
 */
export function addLayerParams(a: AddLayerSettings, r: RepaintSettings) {
  return {
    audio_format: useSettings.getState().exportSettings.audioFormat,
    ...(a.model ? { model: a.model } : {}),
    ...(r.inferenceSteps > 0 ? { inference_steps: r.inferenceSteps } : {}),
    ...(r.guidanceScale > 0 ? { guidance_scale: r.guidanceScale } : {}),
    use_random_seed: r.randomSeed,
    ...(r.randomSeed ? {} : { seed: r.seed }),
    ...ditAdvancedParams(r),
    ...lmAdvancedParams(r),
  };
}
