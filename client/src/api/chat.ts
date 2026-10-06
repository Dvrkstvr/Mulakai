/** Chat slice (C0a, F-041..F-045): the wire types and HTTP for `routes/chat.ts` and `routes/chatTurns.ts`.
 * Mirrored by hand from pipeline/architecture.md "Chat (C0)" (routes, "Data (chat)") and the server's
 * `chat/chatTypes.ts`; reconcile both when either moves. Job progress is the existing `jobStatus` poll. */
import type { ReadingView, ReferenceView } from './chatReferences';
import { ApiError, json } from './http';

/** GET /api/chat/status: `configured` = LLM_API_URL and YUE_API_URL are set (D-099); `assistant` = the planner answers. */
export interface ChatStatus { configured: boolean; assistant: 'ok' | 'off'; cause?: string | null }

export type ChatLyricTag = 'Verse' | 'Pre-Chorus' | 'Chorus' | 'Bridge' | 'Outro';
export type ChatSectionTag = 'Intro' | ChatLyricTag;
/** One sung section of the draft's lyrics; instrumental sections live only in `structure`. */
export interface ChatLyricSection { tag: ChatLyricTag; lines: string[] }

/** The draft's fields (D-086): the sidebar shows and edits these; CREATE SONG sends them. Empty = null / []. */
export interface ChatDraftFields {
  title: string | null;
  style: string | null;
  bpm: number | null;
  /** yue-server's key names: `Am`, `F#`, … */
  key: string | null;
  timeSignature: string | null;
  language: string | null;
  structure: ChatSectionTag[];
  lyrics: ChatLyricSection[];
  engine: 'yue2';
}
export type ChatDraftKey = keyof ChatDraftFields;

/** How a recipe uses the thread's reading (D-128): a cover sings the score; a borrow takes tempo, key, meter, structure. */
export type ChatReferenceUse = 'cover' | 'borrow' | 'none';
/** The draft's reference (C3, additive under `draft_v: 1`). */
export interface ChatDraftReference { referenceId: string; use: 'cover' | 'borrow' }

/** `touched[field]` = the draft `rev` of the person's last hand edit of it; a reply skips fields touched after its SEND.
 * C3: `borrowed` = fields filled from the reading (REFERENCE, or FROM THE SCORE and locked on a cover); `missing` = fields
 * the reading has no value for, left blank and said so (F-064 edge). Absent = none. */
export interface ChatDraft {
  draft_v: 1; rev: number; fields: ChatDraftFields; touched: Partial<Record<ChatDraftKey, number>>;
  reference?: ChatDraftReference; borrowed?: ChatDraftKey[]; missing?: ChatDraftKey[];
}

export type ChatMessageKind = 'text' | 'say' | 'ask' | 'recipe' | 'edit' | 'failed' | 'song' | 'version' | 'analyze' | 'reading';
/** `chat/messageView.ts`'s state; null for a plain line that has no life of its own (say, a song card). C3:
 * `reading` (a reading card's job between its steps) is this client's assumption until CR-4's messageView lands. */
export type ChatMessageState =
  | 'queued' | 'thinking' | 'pending' | 'superseded' | 'expired' | 'committing' | 'done' | 'failed' | 'cancelled' | 'interrupted'
  | 'reading';

/** A recipe as the turn proposed it (SP-5's shape, camel-cased like the draft). */
export interface ChatRecipe extends Omit<ChatDraftFields, 'engine'> {
  engine: 'yue2' | 'acestep';
  /** C3: present only when the thread has a reading (the server's `Recipe.reference_use`). */
  reference_use?: ChatReferenceUse;
}

/** `body_json` per kind (`chat_v: 1`; an additive field needs no bump, readers treat it as absent). */
/** `attach`: the reference SEND carried (C3). */
export interface ChatUserBody { chat_v: 1; sentRev: number; attach?: ChatAttach }
export interface ChatAttach { referenceId: string }
export interface ChatRecipeBody {
  chat_v: 1; recipe: ChatRecipe; assumptions: string[]; changed: ChatDraftKey[]; skipped: ChatDraftKey[];
  /** The take's estimated length, for "about N min"; absent = the line names no length. */
  estSeconds?: number | null;
  /** C3: the reading this recipe was built on and what code filled from it. */
  reference?: ChatRecipeReference;
}
/** `note`: why a cover became a borrow, or another word for the card (F-063 edge); null when none. */
export interface ChatRecipeReference {
  referenceId: string; use: 'cover' | 'borrow'; borrowed: ChatDraftKey[]; missing: ChatDraftKey[]; note: string | null;
}
/** What an analyze card reads: an attached (copied) reference, or a library song named in words (copied at READ). */
export type ChatAnalyzeTarget = { referenceId: string } | { songId: string };
/** GPU seconds per step and in total (the server's referenceRules.readingEstimate). */
export interface ChatReadingEstimate { words: number; score: number; caption: number; total: number }
/** The READ card (proposal kind `analyze`). `seconds` null = unknown (a library song not copied yet); the reading
 * reads `[0, readTo)` s, `cut` when the file is longer (D-138). */
export interface ChatAnalyzeBody {
  chat_v: 1; target: ChatAnalyzeTarget; name: string; seconds: number | null; readTo: number; cut: boolean;
  estimate: ChatReadingEstimate;
}
/** The reading card: the job is the message's `jobId`; `reading` is the snapshot once saved. `followUp`: the server
 * queues the follow-up turn when it saves (D-129); RE-ANALYZE does not. */
export interface ChatReadingBody { chat_v: 1; referenceId: string; name: string; followUp: boolean; reading: ReadingView | null }
export interface ChatAskBody { chat_v: 1; choices: string[] }
/** `cause: 'offline'` = the planner did not answer (ASSISTANT OFF); anything else is a failed turn. */
export interface ChatFailedBody { chat_v: 1; reasons: string[]; cause: string }
export interface ChatSongBody { chat_v: 1; seconds: number | null; label: string; number: number; truncated?: boolean }
export type ChatMessageBody =
  | ChatUserBody | ChatRecipeBody | ChatAskBody | ChatFailedBody | ChatSongBody | ChatAnalyzeBody | ChatReadingBody;

export interface ChatMessageView {
  id: string;
  seq: number;
  role: 'user' | 'assistant';
  kind: ChatMessageKind;
  text: string;
  body: ChatMessageBody | null;
  proposalId: string | null;
  /** The turn job (a user message) or the commit job (a card), for rehydration after a reload. */
  jobId: string | null;
  versionId: string | null;
  state: ChatMessageState | null;
  createdAt: string;
  /** The message's job as the server last saw it (turn or take), for rehydration; absent on older servers. */
  job?: { status: 'queued' | 'loading' | 'running' | 'done' | 'failed'; queuePosition?: number; progressText?: string; cancelled?: boolean; error?: string } | null;
}

/** A thread with its draft: `songId` null = the one draft thread (no song yet). */
export interface ChatThreadView {
  id: string;
  songId: string | null;
  draft: ChatDraft;
  /** Why CREATE SONG is off (`recipeRules.createBlockers`); never computed on the client. */
  blockers: string[];
  draftNote?: string | null;
  messages: ChatMessageView[];
  /** C3: the thread's references, oldest first (the song panel's list); absent on older servers. */
  references?: ReferenceView[];
}

/** A hand edit: only the fields changed; `null` clears a field. */
export type ChatDraftPatch = { [K in ChatDraftKey]?: ChatDraftFields[K] | null };
/** `draftNote`: what the server says about the draft when set (an unknown `draft_v` read as empty, …). */
export interface ChatDraftSaved { draft: ChatDraft; blockers: string[]; draftNote?: string | null }
/** 409 `{ok: false, current}` on PUT draft: the server's draft moved on (a reply landed); rebase the hand edit
 * onto `current`. `blockers` absent = keep the last ones until the rebased PUT answers. */
export type ChatDraftPut = ({ conflict?: false } & ChatDraftSaved) | { conflict: true; draft: ChatDraft; blockers?: string[] };

/** 202 a new turn, 200 a replayed `clientKey` (the first one's job). `position` 0 = it starts now. */
export interface ChatTurnStart { jobId: string; messageId: string; position: number }
/** 202 with the take's job, or the server's re-check reason (proposal gone, blockers, `/api/ps` busy). */
export type ChatCreateStart = { jobId: string } | { refused: string };

const send = (url: string, method: 'POST' | 'PUT', body?: unknown) => fetch(url, {
  method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
});
const get = <T>(url: string): Promise<T> => fetch(url).then((r) => json<T>(r));
const conflictBody = async (res: Response) => (await res.clone().json().catch(() => ({}))) as Record<string, unknown>;

export const chatApi = {
  chatStatus: () => get<ChatStatus>('/api/chat/status'),
  chatDraftThread: () => get<ChatThreadView>('/api/chat/draft'),
  /** NEW CHAT: drops the draft thread and its messages; answers the fresh, empty one. */
  resetChatDraft: async () => {
    const res = await send('/api/chat/draft/reset', 'POST');
    if (res.status === 409) { // a turn or a take still runs in this chat: the server says which
      const reason = (await conflictBody(res)).reason;
      if (typeof reason === 'string') throw new ApiError(reason, 409);
    }
    return json<ChatThreadView>(res);
  },
  chatThread: (threadId: string) => get<ChatThreadView>(`/api/chat/threads/${threadId}`),
  /** OPEN CHAT on a song: its thread, created empty when it has none. */
  songChatThread: (songId: string) => get<ChatThreadView>(`/api/chat/songs/${songId}/thread`),

  /** A hand edit: `fields` is the patch, `rev` the draft it was made on. A 409 carries the current draft. */
  putChatDraft: async (threadId: string, fields: ChatDraftPatch, rev: number): Promise<ChatDraftPut> => {
    const res = await send(`/api/chat/threads/${threadId}/draft`, 'PUT', { fields, rev });
    if (res.status === 409) {
      const body = await conflictBody(res);
      const current = (body.current ?? body.draft) as ChatDraft | undefined;
      if (current) return { conflict: true, draft: current, blockers: body.blockers as string[] | undefined };
    }
    return json<ChatDraftSaved>(res);
  },

  /** `attach` (C3): the composer's attached reference rides on the user message. A 409 `TURN_OPEN` (a reading or
   * its follow-up turn still runs) is an error carrying the server's reason. */
  startChatTurn: async (threadId: string, text: string, clientKey: string, attach?: ChatAttach | null) => {
    const res = await send(`/api/chat/threads/${threadId}/turns`, 'POST', attach ? { text, clientKey, attach } : { text, clientKey });
    if (res.status === 409) {
      const reason = (await conflictBody(res)).reason;
      if (typeof reason === 'string') throw new ApiError(reason, 409);
    }
    return json<ChatTurnStart>(res);
  },

  /** Queued: leaves the line. Thinking: aborts the planner call; the slot frees after the unload. */
  cancelChatJob: (jobId: string) =>
    send(`/api/chat/jobs/${jobId}/cancel`, 'POST').then((r) => json<{ ok: true; cancelled?: true; aborted?: true }>(r)),

  /** CREATE SONG from a recipe card: the server sends the live draft, not the proposal (F-044). */
  createChatSong: async (threadId: string, proposalId: string): Promise<ChatCreateStart> => {
    const res = await send(`/api/chat/threads/${threadId}/create`, 'POST', { proposalId });
    if (res.status === 409) {
      const body = await conflictBody(res);
      const reason = body.reason ?? body.error;
      if (typeof reason === 'string') return { refused: reason };
      throw new ApiError('HTTP 409', 409);
    }
    return json<{ jobId: string }>(res);
  },
};
