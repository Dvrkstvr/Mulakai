/**
 * What each output container can actually hold. Bit depth is not a free choice
 * alongside format — FLAC has no 32-bit float encoding and MP3 has no bit depth
 * at all — so the UI clamps rather than offering an impossible pair.
 * Mirrored server-side by services/audioOutput.ts (a 3-row table, deliberately
 * duplicated rather than introducing a shared package for it).
 */
export type AudioFormat = 'wav' | 'flac' | 'mp3';
export type SampleRate = 48000 | 44100;
export type BitDepth = 16 | 24 | 32;
export type Mp3Bitrate = 128 | 192 | 256 | 320;

export const FORMATS: AudioFormat[] = ['wav', 'flac', 'mp3'];
export const SAMPLE_RATES: SampleRate[] = [48000, 44100];
export const MP3_BITRATES: Mp3Bitrate[] = [128, 192, 256, 320];

/** Depths offered per format, ascending. `mp3` carries none — it uses kbps instead. */
export const DEPTHS_BY_FORMAT: Record<AudioFormat, BitDepth[]> = {
  wav: [16, 24, 32],
  flac: [16, 24],
  mp3: [],
};

/** Highest depth the format can hold. 0 for mp3, which has no depth to pick. */
export function maxDepth(format: AudioFormat): BitDepth | 0 {
  const depths = DEPTHS_BY_FORMAT[format];
  return depths.length ? depths[depths.length - 1] : 0;
}

/** Snap a depth into what `format` supports, preferring the highest available.
 * Called on every format change so switching wav(32) -> flac lands on 24, not
 * a 32 that would silently encode as something else. */
export function clampDepth(format: AudioFormat, depth: BitDepth): BitDepth {
  const depths = DEPTHS_BY_FORMAT[format];
  if (!depths.length) return depth; // mp3: keep the value for when they switch back
  return depths.includes(depth) ? depth : depths[depths.length - 1];
}

export function formatExt(format: AudioFormat): string {
  return format;
}

/** 32-bit wav is float, not int — the distinction matters to the encoder and to
 * the label the UI shows. */
export function depthLabel(format: AudioFormat, depth: BitDepth): string {
  if (format === 'wav' && depth === 32) return '32-BIT FLOAT';
  return `${depth}-BIT`;
}
