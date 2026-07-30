import { describe, it, expect } from 'vitest';
import { ffmpegArgs } from './transcode.js';
import { parseOutputSettings, DEFAULT_OUTPUT, outputExt } from './audioOutput.js';

/** The arg table is where the format rules live, so it's asserted directly —
 * no ffmpeg binary needed. */
describe('ffmpegArgs', () => {
  const args = (over: Partial<typeof DEFAULT_OUTPUT>) =>
    ffmpegArgs('in.wav', 'out.x', { ...DEFAULT_OUTPUT, ...over });

  it('encodes 32-bit wav as float, not int', () => {
    expect(args({ format: 'wav', bitDepth: 32 })).toContain('pcm_f32le');
  });

  it('encodes 16/24-bit wav as int PCM', () => {
    expect(args({ format: 'wav', bitDepth: 16 })).toContain('pcm_s16le');
    expect(args({ format: 'wav', bitDepth: 24 })).toContain('pcm_s24le');
  });

  it('tags 24-bit flac with bits_per_raw_sample (ffmpeg has no s24 flac fmt)', () => {
    const a = args({ format: 'flac', bitDepth: 24 });
    expect(a).toContain('flac');
    expect(a).toContain('s32');
    expect(a.join(' ')).toContain('-bits_per_raw_sample 24');
  });

  it('carries the mp3 bitrate and never a bit depth', () => {
    const a = args({ format: 'mp3', mp3Bitrate: 320 });
    expect(a.join(' ')).toContain('-b:a 320k');
    expect(a.join(' ')).not.toContain('pcm_');
  });

  it('pins soxr for the non-integer 48k -> 44.1k resample', () => {
    const a = args({ sampleRate: 44100 });
    expect(a.join(' ')).toContain('resampler=soxr');
    expect(a.join(' ')).toContain('-ar 44100');
  });
});

describe('parseOutputSettings', () => {
  it('defaults to lossless when the block is missing', () => {
    expect(parseOutputSettings(undefined)).toEqual(DEFAULT_OUTPUT);
  });

  it('clamps a depth the container cannot hold', () => {
    // 32-bit float has no FLAC encoding — must land on FLAC's 24-bit ceiling.
    expect(parseOutputSettings({ format: 'flac', bitDepth: 32 }).bitDepth).toBe(24);
  });

  it('keeps 32-bit for wav', () => {
    expect(parseOutputSettings({ format: 'wav', bitDepth: 32 }).bitDepth).toBe(32);
  });

  it('falls back rather than throwing on junk', () => {
    const out = parseOutputSettings({ format: 'ogg', sampleRate: 96000, bitDepth: 8, mp3Bitrate: 999 });
    expect(out).toEqual(DEFAULT_OUTPUT);
  });

  it('accepts 44.1k', () => {
    expect(parseOutputSettings({ sampleRate: 44100 }).sampleRate).toBe(44100);
  });

  it('derives the extension from the container', () => {
    expect(outputExt(parseOutputSettings({ format: 'mp3' }))).toBe('mp3');
  });
});
