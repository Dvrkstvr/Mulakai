/** Engine-only generation controls (CFG / TEMPERATURE / TOP-K / COT), persisted per engine.
 * Kept out of settings.ts on purpose: GUIDANCE there is ACE-Step's, and a value tuned for it
 * would mean something else on another engine (PLAN.md design point 11). */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EngineCapabilities, EngineId } from './api';

export type Cot = '' | 'full' | 'melody' | 'off';

/** 0 / '' = AUTO: the field is omitted and the engine uses its own default. */
export interface EngineControlValues {
  cfg: number;
  temperature: number;
  topK: number;
  cot: Cot;
}

export type SliderControl = 'cfg' | 'temperature' | 'topK';
export interface ControlRange { min: number; max: number; step: number }

export const AUTO_CONTROLS: EngineControlValues = { cfg: 0, temperature: 0, topK: 0, cot: '' };

const DEFAULT_RANGES: Record<SliderControl, ControlRange> = {
  cfg: { min: 0, max: 20, step: 0.1 },
  temperature: { min: 0, max: 2, step: 0.05 },
  topK: { min: 0, max: 1000, step: 1 },
};

/** The descriptor carries no ranges, so each engine's live range is kept here (0 = AUTO).
 * The server clamps anyway; these keep the slider inside values that mean something. */
const ENGINE_RANGES: Partial<Record<EngineId, Partial<Record<SliderControl, ControlRange>>>> = {
  // Upstream's default is 1.0 and it calls 1.2 an experiment; 0-20 is only the protocol bound.
  yue2: { cfg: { min: 0, max: 3, step: 0.05 } },
  heartmula: {
    cfg: { min: 0, max: 10, step: 0.1 },
    temperature: { min: 0, max: 2, step: 0.05 },
    topK: { min: 0, max: 1000, step: 1 },
  },
};

export const controlRange = (engine: EngineId, control: SliderControl): ControlRange =>
  ENGINE_RANGES[engine]?.[control] ?? DEFAULT_RANGES[control];

/** The engine's controls, as the Create field names `POST /api/engines/:id/generate` takes.
 * Only controls the engine lists, and only when not AUTO. */
export function engineFields(caps: EngineCapabilities, v: EngineControlValues): Record<string, unknown> {
  const has = (c: EngineCapabilities['extraControls'][number]) => caps.extraControls.includes(c);
  return {
    ...(has('cfg') && v.cfg > 0 ? { cfg: v.cfg } : {}),
    ...(has('temperature') && v.temperature > 0 ? { temperature: v.temperature } : {}),
    ...(has('topK') && v.topK > 0 ? { top_k: v.topK } : {}),
    ...(has('cot') && v.cot ? { cot: v.cot } : {}),
  };
}

interface EngineSettingsState {
  values: Partial<Record<EngineId, EngineControlValues>>;
  set: (engine: EngineId, patch: Partial<EngineControlValues>) => void;
}

export const useEngineSettings = create<EngineSettingsState>()(
  persist(
    (set, get) => ({
      values: {},
      set: (engine, patch) => set({
        values: { ...get().values, [engine]: { ...AUTO_CONTROLS, ...get().values[engine], ...patch } },
      }),
    }),
    { name: 'mulakai-engine-settings' },
  ),
);

export const controlsFor = (s: EngineSettingsState, engine: EngineId): EngineControlValues =>
  ({ ...AUTO_CONTROLS, ...s.values[engine] });
