import { describe, it, expect } from 'vitest';
import { useSettings, mergeSettings } from './settings';
import { migrateSettings } from './settingsPersist';

describe('remaster settings', () => {
  const base = useSettings.getState();

  it('defaults to RECOMMENDED steps and no remembered model', () => {
    expect(base.exportSettings.steps).toBe(0);
    expect(base.exportSettings.remasterModel).toBe('');
  });

  it('fills remasterModel into a blob saved before it existed', () => {
    expect(mergeSettings(base, { exportSettings: { steps: 80 } }).exportSettings.remasterModel).toBe('');
  });

  it('moves a blob still on the old default of 100 steps to RECOMMENDED, once', () => {
    const old = { exportSettings: { audioFormat: 'flac', steps: 100 } };
    expect(migrateSettings(old, 0)).toEqual({ exportSettings: { audioFormat: 'flac', steps: 0 } });
    expect(migrateSettings(old, 1)).toEqual(old);
  });

  it('keeps a hand-set count from before the migration', () => {
    const old = { exportSettings: { steps: 64 } };
    expect(migrateSettings(old, 0)).toEqual(old);
  });

  it('passes a blob with no export block through', () => {
    expect(migrateSettings({ gen: {} }, 0)).toEqual({ gen: {} });
    expect(migrateSettings(undefined, 0)).toBeUndefined();
  });
});
