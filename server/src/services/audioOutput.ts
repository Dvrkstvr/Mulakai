/**
 * Server-side mirror of client/src/formatCaps.ts: the user's chosen output
 * container/rate/depth, parsed off the wire with safe defaults so a request
 * that omits it (or an older client) still writes a sane file.
 *
 * Every producer hands us a lossless master (ACE-Step is always asked for
 * `wav32`; the Demucs/UVR service writes float WAV) and transcode.ts applies
 * these settings once, where the file lands in `audioDir`. See PLAN.md
 * "Output Format: Rate / Depth / Bitrate, Everywhere".
 */
export type AudioFormat = 'wav' | 'flac' | 'mp3';
export type SampleRate = 48000 | 44100;
export type BitDepth = 16 | 24 | 32;

export interface OutputSettings {
  format: AudioFormat;
  sampleRate: SampleRate;
  bitDepth: BitDepth;
  mp3Bitrate: number;
}

const DEPTHS_BY_FORMAT: Record<AudioFormat, BitDepth[]> = {
  wav: [16, 24, 32],
  flac: [16, 24],
  mp3: [],
};

export const DEFAULT_OUTPUT: OutputSettings = {
  format: 'flac',
  sampleRate: 48000,
  bitDepth: 24,
  mp3Bitrate: 320,
};

/** The lossless intermediate every producer is asked for, before transcode. */
export const MASTER_AUDIO_FORMAT = 'wav32';

function clampDepth(format: AudioFormat, depth: BitDepth): BitDepth {
  const depths = DEPTHS_BY_FORMAT[format];
  if (!depths.length) return depth;
  return depths.includes(depth) ? depth : depths[depths.length - 1];
}

/**
 * Parse an `output` blob off a request body. Unknown/missing fields fall back to
 * DEFAULT_OUTPUT rather than throwing — an output preference is never worth
 * failing a generation over, and a wrong-but-valid container is recoverable
 * (re-export) while a 500 loses the whole render.
 */
export function parseOutputSettings(raw: unknown): OutputSettings {
  const o = (raw ?? {}) as Record<string, unknown>;
  const format = (['wav', 'flac', 'mp3'] as const).includes(o.format as AudioFormat)
    ? (o.format as AudioFormat)
    : DEFAULT_OUTPUT.format;
  const rate = Number(o.sampleRate);
  const depth = Number(o.bitDepth);
  const kbps = Number(o.mp3Bitrate);
  return {
    format,
    sampleRate: rate === 44100 ? 44100 : 48000,
    bitDepth: clampDepth(format, ([16, 24, 32] as number[]).includes(depth) ? (depth as BitDepth) : DEFAULT_OUTPUT.bitDepth),
    mp3Bitrate: [128, 192, 256, 320].includes(kbps) ? kbps : DEFAULT_OUTPUT.mp3Bitrate,
  };
}

export function outputExt(out: OutputSettings): string {
  return out.format;
}
