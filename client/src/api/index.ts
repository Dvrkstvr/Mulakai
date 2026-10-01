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
 * The slices spread into one flat `api` object, so method names must stay unique
 * across slices (TypeScript won't flag a collision — the last spread would win).
 */
export * from './types';
export * from './engineTypes';
export { ApiError } from './http';
export type { ScoreSize, Transcription } from './covers';
export type { LyricSegment, LyricWord, LyricsReading, WordTimings } from './lyrics';

import { libraryApi } from './library';
import { generationApi } from './generation';
import { editorApi } from './editor';
import { managementApi } from './management';
import { coversApi } from './covers';
import { lyricsApi } from './lyrics';

export const api = {
  ...libraryApi,
  ...generationApi,
  ...editorApi,
  ...managementApi,
  ...coversApi,
  ...lyricsApi,
};
