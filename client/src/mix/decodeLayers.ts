/** Fetch + decode a list of audio URLs into AudioBuffers, shared by bounce and live playback. */
export interface DecodedLayer {
  id: string;
  volume: number;
  buffer: AudioBuffer;
}

export interface LayerAudioInput {
  id: string;
  audioUrl: string;
  volume: number;
}

export async function decodeUrl(url: string, ctx: AudioContext | OfflineAudioContext): Promise<AudioBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to fetch ${url} -> HTTP ${res.status}`);
  return ctx.decodeAudioData(await res.arrayBuffer());
}

export async function decodeLayers(inputs: LayerAudioInput[], ctx: AudioContext | OfflineAudioContext): Promise<DecodedLayer[]> {
  return Promise.all(
    inputs.map(async (input) => ({ id: input.id, volume: input.volume, buffer: await decodeUrl(input.audioUrl, ctx) })),
  );
}
