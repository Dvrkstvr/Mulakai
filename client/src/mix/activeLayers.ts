import type { Layer, Version } from '../api';

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

export interface AudibleTake {
  layer: Layer;
  version: Version;
}

/**
 * The audible layers (see activeLayers) paired with their active versions, dropping
 * any layer that has none. A bounce reads each take's volume from `take.layer`, so
 * a dropped layer can't shift its neighbours' volumes the way indexing a second,
 * unfiltered list did.
 */
export function audibleTakes(layers: Layer[]): AudibleTake[] {
  return activeLayers(layers).flatMap((layer) => {
    const version = layer.versions.find((v) => v.active);
    return version ? [{ layer, version }] : [];
  });
}
