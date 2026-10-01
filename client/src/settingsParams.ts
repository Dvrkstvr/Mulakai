import { clampDepth } from './formatCaps';
import type { GenSettings, AdvancedSettings, RepaintSettings, AddLayerSettings, ExportSettings } from './settingsTypes';
import { useSettings } from './settingsStore';
import { stepsMax } from './modelInfo';

/**
 * ACE-Step is always asked for its highest-fidelity container regardless of what
 * the user picked; the chosen format/rate/depth is applied once server-side
 * after download (services/transcode.ts). This keeps every producer on one
 * lossless master and avoids a lossy generation feeding a lossy re-encode.
 */
const MASTER_AUDIO_FORMAT = 'wav32';

/** The output block every audio-producing request carries, consumed by the
 * server's parseOutputSettings(). */
export function outputParams(e: ExportSettings = useSettings.getState().exportSettings) {
  return {
    format: e.audioFormat,
    sampleRate: e.sampleRate,
    bitDepth: clampDepth(e.audioFormat, e.bitDepth),
    mp3Bitrate: e.mp3Bitrate,
  };
}

/** Map generation settings to ACE-Step request params. Empty/zero fields = AUTO (omitted). */
export function genParams(g: GenSettings) {
  return {
    audio_format: MASTER_AUDIO_FORMAT,
    output: outputParams(),
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
    ...(g.batchSize > 0 ? { batch_size: g.batchSize } : {}),
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
 * Map the Create rail's settings to a COVER request. `model` is the COVER tab's own
 * picker (cover-capable models only), not `g.model`. STEPS is shared with PROMPT, so it
 * is clamped to this model's ceiling. `cover` skips the LM planner, and the server pins
 * batch_size to 1, so no LM knobs, THINKING/AI ENHANCE or TAKES.
 */
export function coverParams(g: GenSettings, model: string) {
  const steps = Math.min(g.inferenceSteps, stepsMax(model));
  return {
    audio_format: MASTER_AUDIO_FORMAT,
    output: outputParams(),
    ...(model ? { model } : {}),
    ...(steps > 0 ? { inference_steps: steps } : {}),
    ...(g.guidanceScale > 0 ? { guidance_scale: g.guidanceScale } : {}),
    use_random_seed: g.randomSeed,
    ...(g.randomSeed ? {} : { seed: g.seed }),
    ...ditAdvancedParams(g),
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
    audio_format: MASTER_AUDIO_FORMAT,
    output: outputParams(),
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
    audio_format: MASTER_AUDIO_FORMAT,
    output: outputParams(),
    ...(a.model ? { model: a.model } : {}),
    ...(r.inferenceSteps > 0 ? { inference_steps: r.inferenceSteps } : {}),
    ...(r.guidanceScale > 0 ? { guidance_scale: r.guidanceScale } : {}),
    use_random_seed: r.randomSeed,
    ...(r.randomSeed ? {} : { seed: r.seed }),
    ...ditAdvancedParams(r),
    ...lmAdvancedParams(r),
  };
}
