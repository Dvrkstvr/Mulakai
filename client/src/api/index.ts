/**
 * API client barrel — `./api` imports resolve here, so callers (and every
 * vi.mock('./api')) are unchanged from when this was a single api.ts. The client
 * is split by domain to stay inside AGENTS.md's module-size cap:
 *   library.ts     songs, folders, trash, per-song metadata/cover art
 *   generation.ts  the three song-creating tasks, prompt tooling, job/lock status
 *   editor.ts      repaint/versions/layers, remaster, stem splits
 *   management.ts  voices, adapters, lyric tags, output metadata
 *   covers.ts      YuE2 melody covers: transcribe, preview, cover, stored score
 *   lyrics.ts      READ LYRICS: the words sung in a cover's source
 *   queue.ts       the GPU job queue: what runs, what waits, CANCEL
 *   score.ts       the SCORE verb: status, PLAN, the plan run, CANCEL
 *   midi.ts        a score as a MIDI file
 *   retime.ts      re-time a transcribed score from its kept reading
 * The slices spread into one flat `api` object, so method names must stay unique
 * across slices (TypeScript won't flag a collision — the last spread would win).
 */
export * from './types';
export * from './engineTypes';
export { ApiError } from './http';
export type { ScoreSize, Transcription } from './covers';
export type { RecentSong } from './library';
export type { LyricSegment, LyricWord, LyricsReading, WordTimings } from './lyrics';
export type { QueueEntry, QueueRunning, QueueSnapshot } from './queue';
export type * from './score';
export type { RetimeMode, RetimeResult } from './retime';
export { RetimeError } from './retime';

import { libraryApi } from './library';
import { generationApi } from './generation';
import { editorApi } from './editor';
import { managementApi } from './management';
import { coversApi } from './covers';
import { lyricsApi } from './lyrics';
import { queueApi } from './queue';
import { scoreApi } from './score';
import { midiApi } from './midi';
import { retimeApi } from './retime';

export const api = {
  ...libraryApi,
  ...generationApi,
  ...editorApi,
  ...managementApi,
  ...coversApi,
  ...lyricsApi,
  ...queueApi,
  ...scoreApi,
  ...midiApi,
  ...retimeApi,
};
