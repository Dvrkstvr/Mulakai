/**
 * Chat C0 types (pipeline/architecture.md "Chat (C0)", "Data (chat)"). Types only.
 * Stored blobs carry a version key: drafts `draft_v`, message bodies `chat_v`; an additive
 * field needs no bump, a shape change bumps and the reader handles both (versions-data.md).
 */
import type { Op } from '../score/planTypes.js';

/** One sung section of the lyrics: a closed-list tag and its lines (no tags inside lines). */
export interface LyricSection { tag: string; lines: string[] }

/** The one draft's fields (D-086). Absent = not filled yet. `lyrics` are sections; the sung
 * text is built in `structure` order by draftFields.ts. */
export interface DraftFields {
  title?: string;
  style?: string;
  bpm?: number;
  /** One of the 30 key names (`Am`, `F#`), as yue-server's upstream KEYS spells them. */
  key?: string;
  /** `4/4`, `3/4`, `2/4`, `6/8`. */
  timeSignature?: string;
  /** ISO 639-1 code, `en`. */
  language?: string;
  structure?: string[];
  lyrics?: LyricSection[];
  engine?: 'yue2';
}
export type DraftField = keyof DraftFields;

/** draft_json, `draft_v: 1`. `rev` grows on every write that changes a field; `touched` holds
 * the rev of each field's last hand edit, so a reply skips a field touched after SEND (CH-6). */
export interface Draft {
  draft_v: 1;
  rev: number;
  fields: DraftFields;
  touched: Partial<Record<DraftField, number>>;
}

/** A recipe as the model writes it (SP-5's schema; snake_case `time_signature`). */
export interface Recipe {
  title: string;
  style: string;
  bpm: number;
  key: string;
  time_signature: string;
  language: string;
  engine: string;
  structure: string[];
  lyrics: LyricSection[];
}

export type ScalpelKind = 'repaint' | 'add_layer' | 'split' | 'export';

/** One checked turn reply: one action from the closed set (SP-5). */
export type TurnReply =
  | { action: 'ask'; message: string; choices: string[] }
  | { action: 'recipe'; message: string; assumptions: string[]; recipe: Recipe }
  | { action: 'edit'; message: string; assumptions: string[]; ops: Op[] }
  | { action: 'scalpel'; message: string; kind: ScalpelKind; target: string; details: string }
  | { action: 'analyze'; message: string; reference: string; plan: string }
  | { action: 'say'; message: string };
export type TurnAction = TurnReply['action'];

/** A live proposal, in memory only (decisions/0004): a recipe card's, or an edit plan held by planStore. */
export type Proposal = { id: string; threadId: string; messageId: string; createdAt: number }
  & ({ kind: 'recipe'; recipe: Recipe } | { kind: 'edit'; planId: string });

export type MessageRole = 'user' | 'assistant';
export type MessageKind = 'text' | 'say' | 'ask' | 'recipe' | 'edit' | 'failed' | 'song' | 'version';

/** body_json per kind, each with `chat_v: 1` when stored. */
export interface UserBody { sentRev: number }
export interface AskBody { choices: string[] }
export interface RecipeBody { recipe: Recipe; assumptions: string[]; changed: DraftField[]; skipped: DraftField[] }
export interface EditBody {
  planId: string;
  ops: Op[];
  verdicts: unknown[];
  checks: unknown;
  splice: { from_bar: number; to_bar: number } | { reason: string };
}
export interface CardBody { seconds: number | null; label: string; number: number }
export interface FailedBody { reasons: string[]; cause: string }
export type MessageBody = UserBody | AskBody | RecipeBody | EditBody | CardBody | FailedBody;

/** One chat_messages row, decoded. `body` is null when absent or of an unknown `chat_v`. */
export interface ChatMessage {
  id: string;
  threadId: string;
  seq: number;
  role: MessageRole;
  kind: MessageKind;
  text: string;
  body: MessageBody | null;
  proposalId: string | null;
  jobId: string | null;
  versionId: string | null;
  clientKey: string | null;
  createdAt: string;
}

/** One chat_threads row, decoded. `songId` null = the draft thread. `draftNote` says why a
 * stored draft could not be read (an unknown `draft_v`), else null. */
export interface ChatThread {
  id: string;
  songId: string | null;
  draft: Draft;
  draftNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What the client shows for a message (messageView.ts, CA-3). */
export type MessageState =
  | 'queued' | 'thinking' | 'pending' | 'superseded' | 'expired'
  | 'committing' | 'done' | 'failed' | 'cancelled' | 'interrupted';
export interface MessageView extends ChatMessage { state: MessageState | null }

export interface ThreadView {
  id: string;
  songId: string | null;
  draft: Draft;
  draftNote: string | null;
  /** Why CREATE SONG is disabled (recipeRules.createBlockers); empty = enabled. */
  blockers: string[];
  messages: MessageView[];
}
