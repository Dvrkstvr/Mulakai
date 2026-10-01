/**
 * Settings barrel — `./settings` imports resolve here, so every importer is
 * unchanged from when this was a single module. Split by responsibility to stay
 * inside AGENTS.md's module-size cap:
 *   settingsTypes.ts    the settings shapes (gen/repaint/add-layer/export) and store state
 *   settingsPersist.ts  deep-merge + migration of the persisted localStorage blob
 *   settingsStore.ts    the persisted zustand store: defaults and setters
 *   settingsParams.ts   settings -> ACE-Step request params, and the output block
 */
export type {
  GenSettings,
  AdvancedSettings,
  RepaintSettings,
  AddLayerSettings,
  AudioFormat,
  SampleRate,
  BitDepth,
  Mp3Bitrate,
  ExportSettings,
  SettingsState,
} from './settingsTypes';
export { mergeSettings, migrateExportSettings } from './settingsPersist';
export { useSettings } from './settingsStore';
export { outputParams, genParams, repaintParams, addLayerParams } from './settingsParams';
