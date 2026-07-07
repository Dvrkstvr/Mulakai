import type { Song } from './api';

export type GenType = 'prompt' | 'audio' | 'complete';
export type Source = 'upload' | 'library';

/** Prefill for the Create screen — built either from a plain typed prompt
 * (Library's create bar) or from an existing song (the detail rail's REUSE
 * PROMPT / CREATE COVER FROM AUDIO actions). */
export interface CreateDraft {
  genType?: GenType;
  source?: Source;
  selectedSongId?: string;
  prompt?: string;
  lyrics?: string;
  bpm?: number;
  keyScale?: string;
  timeSignature?: string;
  duration?: number;
}

export const promptDraft = (prompt: string): CreateDraft => ({ prompt });

export const reusePromptDraft = (song: Song): CreateDraft => ({
  genType: 'prompt',
  prompt: song.caption,
  lyrics: song.lyrics,
  ...(song.bpm ? { bpm: song.bpm } : {}),
  ...(song.key_scale ? { keyScale: song.key_scale } : {}),
  ...(song.time_signature ? { timeSignature: song.time_signature } : {}),
  ...(song.duration ? { duration: song.duration } : {}),
});

export const createCoverDraft = (song: Song): CreateDraft => ({
  genType: 'audio',
  source: 'library',
  selectedSongId: song.id,
});
