import { clampDepth, maxDepth, type BitDepth } from './formatCaps';
import type { ExportSettings, SettingsState } from './settingsTypes';
import { migrateQuality } from './qualitySteps';

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
    gen: { ...current.gen, ...p.gen, quality: p.gen ? migrateQuality(p.gen) : current.gen.quality },
    repaint: { ...current.repaint, ...p.repaint },
    addLayer: { ...current.addLayer, ...p.addLayer },
    exportSettings: migrateExportSettings({ ...current.exportSettings, ...p.exportSettings }),
  };
}

/**
 * Bring a persisted export block onto the current three-format model. The old
 * enum had six values: `wav32` was never a format (it is wav at 32-bit float,
 * which is now expressible directly), and `opus`/`aac` were dropped — both
 * collapse to the lossless default rather than silently downgrading someone to
 * a lossy container they didn't pick. Also re-clamps depth, since a blob saved
 * under `wav` at 32 must not survive a switch to `flac`.
 */
export function migrateExportSettings(e: ExportSettings): ExportSettings {
  const legacy = e.audioFormat as string;
  if (legacy === 'wav32') return { ...e, audioFormat: 'wav', bitDepth: 32 };
  if (legacy === 'opus' || legacy === 'aac') {
    return { ...e, audioFormat: 'flac', bitDepth: maxDepth('flac') as BitDepth };
  }
  return { ...e, bitDepth: clampDepth(e.audioFormat, e.bitDepth) };
}
