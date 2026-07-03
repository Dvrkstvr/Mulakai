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
}

export interface RepaintSettings {
  model: string; // '' = server default. No LM model here: ACE-Step skips the
  // LM planner entirely for repaint (docs/ace-step-1.5/API.md#4.2).
  repaintStrength: number; // VARIANCE 0-1; inverse of audio_cover_strength
  inferenceSteps: number;
  guidanceScale: number;
  randomSeed: boolean;
  seed: number;
}

export interface AddLayerSettings {
  model: string; // '' = server default. Must be lego-capable (Base model) — client filters options.
  // Steps/guidance are shared with RepaintSettings (see repaintParams) rather than
  // duplicated here — Add Layer is another ACE-Step conditioning op on the same song.
  randomSeed: boolean;
  seed: number;
}

interface SettingsState {
  gen: GenSettings;
  repaint: RepaintSettings;
  addLayer: AddLayerSettings;
  setGen: (patch: Partial<GenSettings>) => void;
  setRepaint: (patch: Partial<RepaintSettings>) => void;
  setAddLayer: (patch: Partial<AddLayerSettings>) => void;
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
      },
      repaint: {
        model: '', // '' = AUTO (model's own default)
        repaintStrength: 0.5,
        inferenceSteps: 0, // 0 = AUTO
        guidanceScale: 0, // 0 = AUTO
        randomSeed: true,
        seed: 0,
      },
      addLayer: {
        model: '', // '' = AUTO — but AUTO isn't guaranteed lego-capable; UI requires an explicit pick.
        randomSeed: true,
        seed: 0,
      },
      setGen: (patch) => set((s) => ({ gen: { ...s.gen, ...patch } })),
      setRepaint: (patch) => set((s) => ({ repaint: { ...s.repaint, ...patch } })),
      setAddLayer: (patch) => set((s) => ({ addLayer: { ...s.addLayer, ...patch } })),
    }),
    { name: 'mulakai-settings' },
  ),
);

/** Map generation settings to ACE-Step request params. Empty/zero fields = AUTO (omitted). */
export function genParams(g: GenSettings) {
  return {
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
  };
}

/**
 * Map repaint settings to ACE-Step request params (region added by caller).
 * `audio_cover_strength` (docs/ace-step-1.5/API.md#4.2) is the real knob:
 * higher = closer to source, lower = more freedom. VARIANCE is its inverse
 * so the slider reads "amount of change" the way the UI presents it.
 */
export function repaintParams(r: RepaintSettings) {
  return {
    ...(r.model ? { model: r.model } : {}),
    audio_cover_strength: 1 - r.repaintStrength,
    ...(r.inferenceSteps > 0 ? { inference_steps: r.inferenceSteps } : {}),
    ...(r.guidanceScale > 0 ? { guidance_scale: r.guidanceScale } : {}),
    use_random_seed: r.randomSeed,
    ...(r.randomSeed ? {} : { seed: r.seed }),
  };
}

/**
 * Map Add Layer settings to ACE-Step request params. `model` is required (lego
 * needs a Base model). Steps/guidance come from RepaintSettings — Add Layer has
 * no dedicated controls for these, so it shares whatever the user set for repaint.
 */
export function addLayerParams(a: AddLayerSettings, r: RepaintSettings) {
  return {
    ...(a.model ? { model: a.model } : {}),
    ...(r.inferenceSteps > 0 ? { inference_steps: r.inferenceSteps } : {}),
    ...(r.guidanceScale > 0 ? { guidance_scale: r.guidanceScale } : {}),
    use_random_seed: a.randomSeed,
    ...(a.randomSeed ? {} : { seed: a.seed }),
  };
}
