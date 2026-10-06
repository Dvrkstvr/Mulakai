/** Chat C3 slice (F-061, F-062): reference upload (with progress), library pick, list, READ and RE-ANALYZE, for
 * `routes/chatReferences.ts`. Mirrored by hand from pipeline/architecture.md "Chat (C3)" (routes, "Data (C3)",
 * `Reading` v1) and the server's `chat/{chatTypes,reading}.ts`; reconcile both when either moves. */
import { ApiError, json } from './http';

export type ReadingPartSource = 'own' | 'service' | 'skip';
/** A part the reading could not fill says why ("not read: LYRICS_API_URL is not set"); never an empty part. */
export interface NotRead { notRead: string }
export interface ReadingWords { language: string | null; lines: string[]; instrumental: boolean }
export interface ReadingScoreFacts {
  header?: Record<string, string>;
  /** One per score section: its `% label`, bars and sung lines. */
  sections?: { label: string; bars: number; lines?: number }[];
  lyric_blocks?: number;
  bars?: number;
}
export interface ReadingScore {
  abc: string; source: 'own' | 'transcribed'; chords: boolean; facts: ReadingScoreFacts; warnings: string[]; measure?: unknown;
}
export interface ReadingCaption { caption: string | null; bpm: number | null; key: string | null; meter: string | null }

/** `Reading` (`reading_v: 1`): a newer version than this client knows reads as null ("read again"). */
export interface ReadingView {
  reading_v: 1;
  readAt: string;
  /** The whole file's length; `readTo` = what was read (the first 360 s at most, `cut` = it was longer, D-138). */
  seconds: number;
  readTo: number;
  cut: boolean;
  plan: { words: ReadingPartSource; score: ReadingPartSource; caption: ReadingPartSource };
  words: ReadingWords | NotRead;
  score: ReadingScore | NotRead;
  caption: ReadingCaption | NotRead;
}

/** One `chat_references` row as the thread view sends it. `url` plays it (the `/audio` static route, A/B). */
export interface ReferenceView {
  id: string;
  threadId: string;
  origin: 'upload' | 'library';
  name: string;
  sourceSongId: string | null;
  url: string;
  bytes: number;
  seconds: number | null;
  reading: ReadingView | null;
  createdAt: string;
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
  /** Multipart `audio`; a non-audio or unreadable file is a 400 whose reason is the error (F-061 edge). */
  uploadReference: (threadId: string, file: File, opts: UploadOpts = {}) => new Promise<ReferenceView>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/chat/threads/${threadId}/references`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      let body: Record<string, unknown> = {};
      try { body = JSON.parse(xhr.responseText) as Record<string, unknown>; } catch { /* not JSON: the status says it */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body as unknown as ReferenceView);
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
    return res.json() as Promise<ReferenceView>;
  },

  listReferences: (threadId: string) => fetch(`/api/chat/threads/${threadId}/references`).then((r) => json<ReferenceView[]>(r)),

  /** READ on an analyze card: 202 the reading job; the follow-up turn runs after it on the server (D-129). */
  readReference: async (threadId: string, proposalId: string) =>
    readStart(await post(`/api/chat/threads/${threadId}/read`, { proposalId })),

  /** RE-ANALYZE from the song panel: a new reading card, no follow-up turn. */
  rereadReference: async (referenceId: string) => readStart(await post(`/api/chat/references/${referenceId}/read`)),
};
