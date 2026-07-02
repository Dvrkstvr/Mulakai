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
        repaintMode: 'balanced',
        repaintStrength: 0.5,
        inferenceSteps: 0, // 0 = AUTO
        guidanceScale: 0, // 0 = AUTO
        randomSeed: true,
        seed: 0,
      },
      setGen: (patch) => set((s) => ({ gen: { ...s.gen, ...patch } })),
      setRepaint: (patch) => set((s) => ({ repaint: { ...s.repaint, ...patch } })),
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
    ...(g.inferenceSteps > 0 ? { inference_steps: g.inferenceSteps } : {}),
    ...(g.guidanceScale > 0 ? { guidance_scale: g.guidanceScale } : {}),
    use_random_seed: g.randomSeed,
    ...(g.randomSeed ? {} : { seed: g.seed }),
  };
}

/** Map repaint settings to ACE-Step request params (region added by caller). Zero steps/guidance = AUTO. */
export function repaintParams(r: RepaintSettings) {
  return {
    repaint_mode: r.repaintMode,
    repaint_strength: r.repaintStrength,
    ...(r.inferenceSteps > 0 ? { inference_steps: r.inferenceSteps } : {}),
    ...(r.guidanceScale > 0 ? { guidance_scale: r.guidanceScale } : {}),
    use_random_seed: r.randomSeed,
    ...(r.randomSeed ? {} : { seed: r.seed }),
  };
}
