import type { Layer } from '../api';

/**
 * Standard solo/mute selection: if any layer is soloed, only soloed layers
 * play; otherwise all non-muted layers play. Mute is an absolute "never" —
 * a layer that is both muted and soloed is still excluded.
 */
export function activeLayers(layers: Layer[]): Layer[] {
  const anySolo = layers.some((l) => l.solo && !l.muted);
  return layers.filter((l) => {
    if (l.muted) return false;
    return anySolo ? l.solo : true;
  });
}
