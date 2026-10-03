import type { Layer } from './api';
import { audibleTakes } from './mix/activeLayers';
import { decodeLayers, type LayerAudioInput } from './mix/decodeLayers';
import { bounceMix, encodeWav } from './mix/bounceMix';

/** What a bounce of what you hear decodes: the audible layers' active takes (mute/solo) at their volumes. */
export function mixInputs(layers: Layer[]): LayerAudioInput[] {
  return audibleTakes(layers).map((x, i) => ({ id: String(i), audioUrl: `/audio/${x.version.audio_file}`, volume: x.layer.volume }));
}

/** EXPORT › MIX's file name: the song's title as a WAV. */
export function mixFilename(title: string): string {
  return `${title.trim() || 'mix'}.wav`;
}

/**
 * Bounces what you hear to a 16-bit WAV, client-side — the same mix Add Layer conditions on
 * and Remaster covers. Untagged: there is no server pass to stamp metadata.
 */
export async function bounceAudible(layers: Layer[]): Promise<Blob> {
  const inputs = mixInputs(layers);
  if (inputs.length === 0) throw new Error('no audible layers to mix — unmute or un-solo at least one layer');
  const ctx = new AudioContext();
  try {
    return encodeWav(await bounceMix(await decodeLayers(inputs, ctx)));
  } finally {
    await ctx.close();
  }
}

/** Hands `blob` to the browser as a download named `filename`. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking at once can cancel a download the browser hasn't started reading yet.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
