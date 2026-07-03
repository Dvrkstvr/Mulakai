/** Fetch + decode a list of audio URLs into AudioBuffers, shared by bounce and (later) live playback. */
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

export async function decodeLayers(inputs: LayerAudioInput[], ctx: AudioContext | OfflineAudioContext): Promise<DecodedLayer[]> {
  return Promise.all(
    inputs.map(async (input) => {
      const res = await fetch(input.audioUrl);
      if (!res.ok) throw new Error(`failed to fetch ${input.audioUrl} -> HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      return { id: input.id, volume: input.volume, buffer };
    }),
  );
}
