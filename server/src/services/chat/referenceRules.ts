/**
 * What a reference must be and what reading it costs (F-061, D-138), pure. An upload is an audio
 * file by its name (the probe reads by extension), not empty, within the cover upload limit, and
 * with a probed length > 0. A reading reads the first 360 s. The GPU estimate's constants are
 * placeholders until CP-C3 calibrates them (architecture "Chat (C3)").
 */
import type { ReadingEstimate } from './chatTypes.js';
import type { ReadingPlanSources } from './reading.js';

export const READ_LIMIT_S = 360;

const AUDIO_EXTS = ['mp3', 'wav', 'flac', 'ogg', 'oga', 'm4a', 'mp4', 'aac', 'opus', 'aiff', 'aif', 'webm'];
const NAMED = 'MP3, WAV, FLAC, OGG, M4A, AAC, OPUS, AIFF, WEBM';

/** The file's audio extension (lower case), or null when its name is not an audio file's. */
export function referenceExt(filename: string): string | null {
  const m = /\.([A-Za-z0-9]+)$/.exec(filename);
  const ext = m ? m[1].toLowerCase() : '';
  return AUDIO_EXTS.includes(ext) ? ext : null;
}

/** Why this file cannot be a reference (the card's rust line), or null. `seconds`: the probe. */
export function uploadProblem(f: { filename: string; bytes: number; seconds: number | null; maxMb: number }): string | null {
  if (!referenceExt(f.filename)) return `${f.filename} is not an audio file (${NAMED})`;
  if (f.bytes <= 0) return `${f.filename} is empty`;
  if (f.bytes > f.maxMb * 1024 * 1024) return `${f.filename} is over ${f.maxMb} MB`;
  if (!f.seconds || f.seconds <= 0) return `${f.filename} could not be read as audio: is it a broken or non-audio file?`;
  return null;
}

/** What a reading reads: `[0, to)` s; `cut` when the file is longer (D-138). Unknown length: up to the limit. */
export function readSpan(seconds: number | null): { to: number; cut: boolean } {
  if (seconds === null || seconds <= READ_LIMIT_S) return { to: seconds ?? READ_LIMIT_S, cut: false };
  return { to: READ_LIMIT_S, cut: true };
}

/** GPU seconds per step: a fixed start (model load, subprocess) plus a share of the audio read.
 * Placeholders, calibrated in CP-C3 (SheetSage2 took 45 s on 7:47; READ LYRICS 16 s, PLAN.md). */
const COST: Record<keyof ReadingPlanSources, { base: number; perSecond: number }> = {
  words: { base: 8, perSecond: 0.04 },
  score: { base: 15, perSecond: 0.1 },
  caption: { base: 10, perSecond: 0.03 },
};

export function readingEstimate(plan: ReadingPlanSources, seconds: number | null): ReadingEstimate {
  const read = readSpan(seconds).to;
  const step = (k: keyof ReadingPlanSources) => (plan[k] === 'service' ? Math.round(COST[k].base + COST[k].perSecond * read) : 0);
  const words = step('words');
  const score = step('score');
  const caption = step('caption');
  return { words, score, caption, total: words + score + caption };
}
