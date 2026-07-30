/**
 * The single output boundary. Producers emit a lossless master (ACE-Step is
 * asked for `wav32`, the Demucs/UVR service writes float WAV) and everything
 * that lands in `audioDir` passes through here exactly once — never
 * lossy -> lossy. See PLAN.md "Output Format: Rate / Depth / Bitrate,
 * Everywhere".
 *
 * ffmpeg is already a de-facto prerequisite of this project (demucs-server
 * needs it, ACE-Step's setup installs it); `probeFfmpeg()` makes that explicit
 * at startup rather than discovering it mid-generation.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import type { OutputSettings } from './audioOutput.js';

const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg';

/** Codec + sample-format flags per container. 32-bit wav is *float* (pcm_f32le);
 * FLAC has no float encoding, so 24-bit rides in an s32 container tagged with
 * `bits_per_raw_sample` — that is how ffmpeg expresses 24-bit FLAC. */
function codecArgs(out: OutputSettings): string[] {
  if (out.format === 'mp3') return ['-c:a', 'libmp3lame', '-b:a', `${out.mp3Bitrate}k`];
  if (out.format === 'flac') {
    return out.bitDepth === 16
      ? ['-c:a', 'flac', '-sample_fmt', 's16']
      : ['-c:a', 'flac', '-sample_fmt', 's32', '-bits_per_raw_sample', '24'];
  }
  const pcm = out.bitDepth === 16 ? 'pcm_s16le' : out.bitDepth === 24 ? 'pcm_s24le' : 'pcm_f32le';
  return ['-c:a', pcm];
}

/**
 * Full ffmpeg argv. Exported so the mapping is unit-testable without ffmpeg
 * installed — the arg table is the part that carries the format rules.
 *
 * 48k -> 44.1k is a non-integer 147/160 ratio, so resampling is pinned to soxr
 * at high precision rather than swresample's default, which is audibly worse on
 * exactly this conversion.
 */
export function ffmpegArgs(inPath: string, outPath: string, out: OutputSettings): string[] {
  return [
    '-hide_banner', '-loglevel', 'error', '-nostdin',
    '-i', inPath,
    '-map', 'a',
    '-af', 'aresample=resampler=soxr:precision=28',
    '-ar', String(out.sampleRate),
    ...codecArgs(out),
    '-y', outPath,
  ];
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (c) => {
      stderr += String(c);
    });
    proc.on('error', (err) =>
      reject(new Error(`ffmpeg could not be launched (${FFMPEG}): ${err.message}`)),
    );
    proc.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.trim().slice(0, 500)}`)),
    );
  });
}

/** Transcode `inPath` to `outPath` per `out`. Both paths are absolute. */
export async function transcodeFile(inPath: string, outPath: string, out: OutputSettings): Promise<void> {
  await runFfmpeg(ffmpegArgs(inPath, outPath, out));
}

/**
 * Transcode an in-memory lossless master straight to its final resting path.
 * Producers hand us buffers (downloadAudio, the split service's fetch), so the
 * master is staged in the OS temp dir and removed once encoded — it is never
 * written into `audioDir`, where it would be served and counted as library
 * audio.
 */
export async function transcodeBuffer(master: Buffer, outPath: string, out: OutputSettings): Promise<void> {
  const tmp = path.join(os.tmpdir(), `mulakai-master-${crypto.randomUUID()}.wav`);
  try {
    await fs.writeFile(tmp, master);
    await transcodeFile(tmp, outPath, out);
  } finally {
    await fs.rm(tmp, { force: true });
  }
}

let ffmpegOk: boolean | null = null;

/** Cached one-shot availability check. Called at startup so a missing ffmpeg is
 * a loud boot-time failure rather than a wrong-format file discovered later. */
export async function probeFfmpeg(): Promise<boolean> {
  if (ffmpegOk !== null) return ffmpegOk;
  try {
    await runFfmpeg(['-hide_banner', '-loglevel', 'error', '-version']);
    ffmpegOk = true;
  } catch {
    ffmpegOk = false;
  }
  return ffmpegOk;
}
