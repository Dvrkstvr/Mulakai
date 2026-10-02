import { describe, it, expect } from 'vitest';
import type { Layer, Version } from '../api';
import { activeLayers, audibleTakes } from './activeLayers';

const version = (id: string, active: 0 | 1 = 1) => ({ id, audio_file: `${id}.flac`, active }) as Version;

const layer = (id: string, volume: number, opts: { versions?: Version[]; muted?: 0 | 1; solo?: 0 | 1 } = {}) => ({
  id, name: id, volume, muted: opts.muted ?? 0, solo: opts.solo ?? 0,
  versions: opts.versions ?? [version(`${id}-v1`)],
}) as Layer;

const volumes = (layers: Layer[]) => audibleTakes(layers).map((t) => [t.layer.id, t.version.audio_file, t.layer.volume]);

describe('audibleTakes', () => {
  it("keeps each layer's own volume when an earlier layer has no active version", () => {
    const layers = [
      layer('base', 1, { versions: [version('base-v1', 0)] }),
      layer('vocals', 0.4),
      layer('drums', 0.7),
    ];
    // Indexing activeLayers(layers)[i] gave vocals base's 1 and drums vocals' 0.4.
    expect(volumes(layers)).toEqual([
      ['vocals', 'vocals-v1.flac', 0.4],
      ['drums', 'drums-v1.flac', 0.7],
    ]);
  });

  it("pairs each layer with its active version, not its first", () => {
    const layers = [layer('base', 1, { versions: [version('base-v1', 0), version('base-v2', 1)] })];
    expect(volumes(layers)).toEqual([['base', 'base-v2.flac', 1]]);
  });

  it('carries the mute/solo selection through', () => {
    const muted = [layer('base', 1), layer('vocals', 0.5, { muted: 1 })];
    expect(volumes(muted)).toEqual([['base', 'base-v1.flac', 1]]);
    const soloed = [layer('base', 1), layer('vocals', 0.5, { solo: 1, muted: 1 })];
    expect(volumes(soloed)).toEqual([['vocals', 'vocals-v1.flac', 0.5]]);
    expect(activeLayers(soloed).map((l) => l.id)).toEqual(['vocals']);
  });

  it('is empty when nothing audible has an active version', () => {
    expect(audibleTakes([layer('base', 1, { muted: 1 })])).toEqual([]);
    expect(audibleTakes([layer('base', 1, { versions: [] })])).toEqual([]);
  });
});
