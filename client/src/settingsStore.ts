import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SettingsState } from './settingsTypes';
import { mergeSettings } from './settingsPersist';

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
        batchSize: 0, // 0 = AUTO
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
        // Lossless by default, at each container's highest depth — FLAC is
        // bit-identical to WAV, roughly half the size, and carries metadata.
        audioFormat: 'flac',
        sampleRate: 48000,
        bitDepth: 24, // FLAC's ceiling; switching to WAV re-clamps up to 32-bit float
        mp3Bitrate: 320,
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
