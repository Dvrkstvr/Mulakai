/** Chat C3 slice (F-061, F-062): reference upload (with progress), library pick, list, READ and RE-ANALYZE, for
 * `routes/chatReferences.ts`. Mirrored by hand from the server's `chat/{chatTypes,reading}.ts` (`ReferenceView`,
 * `Reading` v1) as CR-1 shipped them; reconcile both when either moves. READ / RE-ANALYZE are CR-4's routes, built here
 * from pipeline/architecture.md "Chat (C3)" until they land. */
import type { ChatReadingEstimate } from './chat';
import type { ScoreSection } from './scoreReferent';
import { ApiError, json } from './http';

export type ReadingPartSource = 'own' | 'service' | 'skip';
/** A part the reading could not fill: `notRead` is the reason only (the card prefixes "not read: "). */
export interface NotRead { notRead: string }
export interface ReadingWords { language: string | null; lines: string[]; instrumental: boolean }
/** yue-server `/v1/scores/read` facts (server `score/planTypes.ts` ScoreFacts). */
export interface ReadingScoreFacts {
  header: { meter: string; unit: string; bpm: number; key: string; bars: number; seconds: number; units_per_quarter: number };
  key_notes: string;
  sections: ScoreSection[];
  lyric_blocks: unknown[];
  bar_map: string[];
}
export interface ReadingScore {
  abc: string; source: 'own' | 'transcribed';
  /** Chord symbols present (D-131); null when unknown. */
  chords: boolean | null;
  /** null when the score does not parse. */
  facts: ReadingScoreFacts | null;
  warnings: string[];
  measure: { budget: number; header: number; sections: { name: string; tokens: number }[] } | null;
}
export interface ReadingCaption { caption: string; bpm: number | null; key: string | null; meter: string | null }

/** `Reading` (`reading_v: 1`), the snapshot on a reading card (`ChatReadingBody.reading`). */
export interface ReadingView {
  reading_v: 1;
  readAt: string;
  /** The whole file's length; `readTo` = what was read (the first 360 s at most, `cut` = it was longer, D-138). */
  seconds: number | null;
  readTo: number;
  cut: boolean;
  plan: { words: ReadingPartSource; score: ReadingPartSource; caption: ReadingPartSource };
  words: ReadingWords | NotRead;
  score: ReadingScore | NotRead;
  caption: ReadingCaption | NotRead;
}

/** One reference on the wire (thread view, routes). `url` plays it (`/audio/references/<id>.<ext>`, A/B). */
export interface ReferenceView {
  id: string;
  origin: 'upload' | 'library';
  name: string;
  sourceSongId: string | null;
  url: string;
  seconds: number | null;
  readTo: number;
  cut: boolean;
  /** A library song's layer count: more than 1 → only its base layer is read (D-137); null for an upload. */
  layers: number | null;
  /** The latest reading's time, null when not read; `readingNote` says why a stored one is unreadable. */
  readAt: string | null;
  readingNote: string | null;
  createdAt: string;
  /** What reading it again costs, priced like the READ card: `total` 0 → no GPU (RE-ANALYZE's line). */
  estimate: ChatReadingEstimate;
}

/** 202 a reading job, or the server's re-check reason (proposal gone, a model loaded, a turn open). */
export type ReadStart = { jobId: string } | { refused: string };

export const isNotRead = (part: unknown): part is NotRead =>
  typeof part === 'object' && part !== null && typeof (part as NotRead).notRead === 'string';

/** `{reason}` or `{error}` of a refusal, else the HTTP status. */
async function reasonOf(res: Response): Promise<string> {
  const body = (await res.clone().json().catch(() => ({}))) as { reason?: unknown; error?: unknown };
  const r = body.reason ?? body.error;
  return typeof r === 'string' ? r : `HTTP ${res.status}`;
}

const post = (url: string, body?: unknown) => fetch(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
});

async function readStart(res: Response): Promise<ReadStart> {
  if (res.status === 409) return { refused: await reasonOf(res) };
  return json<{ jobId: string }>(res);
}

export interface UploadOpts { onProgress?: (fraction: number) => void; signal?: AbortSignal }

export const chatReferencesApi = {
  /** Multipart `audio` → 201 new / 200 the same file again, `{reference}`; 400 / 413 `{reason}` (non-audio,
   * unreadable, too big: F-061 edge); 409 on a song's thread (D-130). */
  uploadReference: (threadId: string, file: File, opts: UploadOpts = {}) => new Promise<ReferenceView>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/chat/threads/${threadId}/references`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      let body: Record<string, unknown> = {};
      try { body = JSON.parse(xhr.responseText) as Record<string, unknown>; } catch { /* not JSON: the status says it */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body.reference as ReferenceView);
      const r = body.reason ?? body.error;
      reject(new ApiError(typeof r === 'string' ? r : `HTTP ${xhr.status}`, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError('the upload did not reach the server', 0));
    xhr.onabort = () => reject(new DOMException('aborted', 'AbortError'));
    opts.signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    const form = new FormData();
    form.append('audio', file, file.name);
    xhr.send(form);
  }),

  /** FROM LIBRARY: a copy of the song's base layer's active take (D-137). */
  pickLibraryReference: async (threadId: string, songId: string): Promise<ReferenceView> => {
    const res = await post(`/api/chat/threads/${threadId}/references/library`, { songId });
    if (!res.ok) throw new ApiError(await reasonOf(res), res.status);
    return ((await res.json()) as { reference: ReferenceView }).reference;
  },

  listReferences: async (threadId: string) =>
    (await json<{ references: ReferenceView[] }>(await fetch(`/api/chat/threads/${threadId}/references`))).references,

  /** READ on an analyze card: 202 the reading job; the follow-up turn runs after it on the server (D-129). */
  readReference: async (threadId: string, proposalId: string) =>
    readStart(await post(`/api/chat/threads/${threadId}/read`, { proposalId })),

  /** RE-ANALYZE from the song panel: a new reading card, no follow-up turn. */
  rereadReference: async (referenceId: string) => readStart(await post(`/api/chat/references/${referenceId}/read`)),
};
