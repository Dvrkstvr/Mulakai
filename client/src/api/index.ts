/**
 * API client barrel — `./api` imports resolve here, so callers (and every
 * vi.mock('./api')) are unchanged from when this was a single api.ts. The client
 * is split by domain to stay inside AGENTS.md's module-size cap:
 *   library.ts     songs, folders, trash, per-song metadata/cover art
 *   generation.ts  the three song-creating tasks, prompt tooling, job/lock status
 *   editor.ts      repaint/versions/layers, remaster, stem splits
 *   management.ts  voices, adapters, lyric tags, output metadata
 * The slices spread into one flat `api` object, so method names must stay unique
 * across slices (TypeScript won't flag a collision — the last spread would win).
 */
export * from './types';
export { ApiError } from './http';

import { libraryApi } from './library';
import { generationApi } from './generation';
import { editorApi } from './editor';
import { managementApi } from './management';

export const api = {
  ...libraryApi,
  ...generationApi,
  ...editorApi,
  ...managementApi,
};
