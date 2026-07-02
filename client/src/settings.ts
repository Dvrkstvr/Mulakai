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
  repaintMode: 'conservative' | 'balanced' | 'aggressive';
  repaintStrength: number; // VARIANCE
  inferenceSteps: number;
  guidanceScale: number;
  randomSeed: boolean;
  seed: number;
}

interface SettingsState {
  gen: GenSettings;
  repaint: RepaintSettings;
  setGen: (patch: Partial<GenSettings>) => void;
  setRepaint: (patch: Partial<RepaintSettings>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      gen: {
        model: '',
        lmModel: '',
        thinking: false,
        useFormat: false,
        inferenceSteps: 8,
        guidanceScale: 7,
        randomSeed: true,
        seed: 0,
      },
      repaint: {
        repaintMode: 'balanced',
        repaintStrength: 0.5,
        inferenceSteps: 8,
        guidanceScale: 7,
        randomSeed: true,
        seed: 0,
      },
      setGen: (patch) => set((s) => ({ gen: { ...s.gen, ...patch } })),
      setRepaint: (patch) => set((s) => ({ repaint: { ...s.repaint, ...patch } })),
    }),
    { name: 'mulakai-settings' },
  ),
);

/** Map generation settings to ACE-Step request params. */
export function genParams(g: GenSettings) {
  return {
    ...(g.model ? { model: g.model } : {}),
    ...(g.lmModel ? { lm_model_path: g.lmModel } : {}),
    thinking: g.thinking,
    use_format: g.useFormat,
    inference_steps: g.inferenceSteps,
    guidance_scale: g.guidanceScale,
    use_random_seed: g.randomSeed,
    ...(g.randomSeed ? {} : { seed: g.seed }),
  };
}

/** Map repaint settings to ACE-Step request params (region added by caller). */
export function repaintParams(r: RepaintSettings) {
  return {
    repaint_mode: r.repaintMode,
    repaint_strength: r.repaintStrength,
    inference_steps: r.inferenceSteps,
    guidance_scale: r.guidanceScale,
    use_random_seed: r.randomSeed,
    ...(r.randomSeed ? {} : { seed: r.seed }),
  };
}
