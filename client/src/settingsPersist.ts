import { clampDepth, maxDepth, type BitDepth } from './formatCaps';
import { TUNE_KEYS, type ExportSettings, type SettingsState, type TuneSettings } from './settingsTypes';
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
    // ADD LAYER's own TUNE (PR 11) starts from the REPAINT knobs it used to share, so nobody's tuning changes.
    addLayer: { ...current.addLayer, ...tuneOf(p.repaint), ...p.addLayer },
    exportSettings: migrateExportSettings({ ...current.exportSettings, ...p.exportSettings }),
  };
}

/** The TUNE knobs of a persisted slice, only those it has. */
function tuneOf(slice: Partial<TuneSettings> | undefined): Partial<TuneSettings> {
  if (!slice) return {};
  return Object.fromEntries(TUNE_KEYS.filter((k) => k in slice).map((k) => [k, slice[k]])) as Partial<TuneSettings>;
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

/** The fixed remaster count before REMASTERED MIX had a STEPS slider (persist version 0). */
const OLD_REMASTER_STEPS = 100;

/**
 * Zustand persist's version migration, run before mergeSettings. Version 1: a blob still on
 * the old fixed 100 remaster steps moves to 0 = RECOMMENDED (PLAN.md "Remaster TUNE"). It runs
 * once, so a count of 100 set by hand afterwards stays.
 */
export function migrateSettings(persisted: unknown, version: number): unknown {
  const p = persisted as { exportSettings?: { steps?: number } } | undefined;
  if (version >= 1 || p?.exportSettings?.steps !== OLD_REMASTER_STEPS) return persisted;
  return { ...p, exportSettings: { ...p.exportSettings, steps: 0 } };
}
