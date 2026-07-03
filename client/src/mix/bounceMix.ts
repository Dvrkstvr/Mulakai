import type { DecodedLayer } from './decodeLayers';

/** Render decoded layers (respecting per-layer volume) down to a single mixed AudioBuffer. */
export async function bounceMix(layers: DecodedLayer[]): Promise<AudioBuffer> {
  if (layers.length === 0) throw new Error('no layers to mix');
  const sampleRate = layers[0].buffer.sampleRate;
  const numChannels = Math.max(...layers.map((l) => l.buffer.numberOfChannels));
  const length = Math.max(...layers.map((l) => l.buffer.length));

  const ctx = new OfflineAudioContext(numChannels, length, sampleRate);
  for (const layer of layers) {
    const source = ctx.createBufferSource();
    source.buffer = layer.buffer;
    const gain = ctx.createGain();
    gain.gain.value = layer.volume;
    source.connect(gain).connect(ctx.destination);
    source.start(0);
  }
  return ctx.startRendering();
}

/**
 * Manual 16-bit PCM WAV encoder — no MP3 library needed for a one-shot
 * conditioning upload; WAV is lossless and trivial to write by hand.
 */
export function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
