import type { Layer } from '../api';

/**
 * Standard solo/mute selection: if any layer is soloed, only soloed layers
 * play — solo overrides mute on that same layer, but layers that are muted
 * and not part of the solo group stay silent. Otherwise (no solo active)
 * all non-muted layers play.
 */
export function activeLayers(layers: Layer[]): Layer[] {
  const anySolo = layers.some((l) => l.solo);
  return layers.filter((l) => (anySolo ? l.solo : !l.muted));
}
