/**
 * Chat C0 types (pipeline/architecture.md "Chat (C0)", "Data (chat)"). Types only.
 * Stored blobs carry a version key: drafts `draft_v`, message bodies `chat_v`; an additive
 * field needs no bump, a shape change bumps and the reader handles both (versions-data.md).
 */
import type { Op } from '../score/planTypes.js';
import type { EditBody } from './editTypes.js';
import type { Reading } from './reading.js';
import type { RangeMark } from './analysisTypes.js';
import type { RecipeUndo, RecipeUndone } from './convergeTypes.js';

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

/** How a recipe uses the thread's read reference (D-128): the same song (cover), its tempo / key /
 * meter / structure for a new song (borrow), or not at all. */
export type ReferenceUse = 'cover' | 'borrow' | 'none';

/** The reference a draft is built on (C3, additive under `draft_v: 1`). */
export interface DraftReference { referenceId: string; use: 'cover' | 'borrow' }

/** draft_json, `draft_v: 1`. `rev` grows on every write that changes a field; `touched` holds
 * the rev of each field's last hand edit, so a reply skips a field touched after SEND (CH-6).
 * C3: `borrowed` = fields code filled from the reading (FROM THE SCORE for a cover, REFERENCE for a
 * borrow); `missing` = fields the reading could not give (left blank, said on the card). */
export interface Draft {
  draft_v: 1;
  rev: number;
  fields: DraftFields;
  touched: Partial<Record<DraftField, number>>;
  reference?: DraftReference;
  borrowed?: DraftField[];
  missing?: DraftField[];
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
  /** C3: present only when the thread has a reading (actionSchema). */
  reference_use?: ReferenceUse;
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

/** What an analyze card reads: an attached (copied) reference, or a library song named in words,
 * copied only at READ (architecture "Chat (C3)" flow 3). */
export type AnalyzeTarget = { referenceId: string } | { songId: string };

/** A live proposal, in memory only (decisions/0004): a recipe card's, an analyze card's (READ), or
 * an edit plan held by planStore. */
export type Proposal = { id: string; threadId: string; messageId: string; createdAt: number }
  & ({ kind: 'recipe'; recipe: Recipe } | { kind: 'edit'; planId: string } | { kind: 'analyze'; target: AnalyzeTarget });

export type MessageRole = 'user' | 'assistant';
export type MessageKind = 'text' | 'say' | 'ask' | 'recipe' | 'edit' | 'failed' | 'song' | 'version' | 'analyze' | 'reading';

/** body_json per kind, each with `chat_v: 1` when stored. `attach`: the reference SEND carried (C3); `mark`: the
 * mark SEND carried, frozen with its label (C1, the echo). */
export interface UserBody { sentRev: number; attach?: { referenceId: string }; mark?: RangeMark }
export interface AskBody { choices: string[] }
/** `reference` (C3): the reading this recipe was built on and what code filled from it. */
export interface RecipeReference {
  referenceId: string;
  use: 'cover' | 'borrow';
  borrowed: DraftField[];
  missing: DraftField[];
  /** Why a cover became a borrow, or another word for the card; null when none. */
  note: string | null;
}
/** C2 (F-059, D-220, additive): `undo` what the turn replaced (only when it filled a field); `undone` once undone. */
export interface RecipeBody { recipe: Recipe; assumptions: string[]; changed: DraftField[]; skipped: DraftField[]; reference?: RecipeReference; undo?: RecipeUndo; undone?: RecipeUndone }
/** The READ card (proposal kind `analyze`): what will be read and its GPU estimate (referenceRules). */
export interface AnalyzeBody {
  target: AnalyzeTarget;
  name: string;
  /** The whole file's length; null when unknown (a library song not copied yet). */
  seconds: number | null;
  /** The reading reads `[0, readTo)` s; `cut` when the file is longer (D-138). */
  readTo: number;
  cut: boolean;
  estimate: ReadingEstimate;
}
/** GPU seconds per step and in total (referenceRules.readingEstimate). */
export interface ReadingEstimate { words: number; score: number; caption: number; total: number }
/** The reading card: the job is the message's `job_id`; `reading` is the snapshot once saved.
 * `followUp`: the server queues the follow-up turn when it saves (D-129); RE-ANALYZE does not. */
export interface ReadingBody { referenceId: string; name: string; followUp: boolean; reading: Reading | null }
export type { EditBase, EditBody } from './editTypes.js';
/** A song / version card. `truncated`: the take hit the length cap; saved, but never DONE (D-025). */
export interface CardBody { seconds: number | null; label: string; number: number; truncated?: boolean }
export interface FailedBody { reasons: string[]; cause: string }
export type MessageBody = UserBody | AskBody | RecipeBody | EditBody | CardBody | FailedBody | AnalyzeBody | ReadingBody;

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
  | 'committing' | 'done' | 'failed' | 'cancelled' | 'interrupted'
  /** C3: a reading card while its reading job runs (before the follow-up turn). */
  | 'reading'
  /** C0b: an edit card whose APPLY was refused because the song changed since the plan (ASK AGAIN). */
  | 'stale';
export interface MessageView extends ChatMessage { state: MessageState | null }

export interface ThreadView {
  id: string;
  songId: string | null;
  draft: Draft;
  draftNote: string | null;
  /** Why CREATE SONG is disabled (recipeRules.createBlockers); empty = enabled. */
  blockers: string[];
  messages: MessageView[];
  /** The thread's references, oldest first (C3). */
  references: ReferenceView[];
}

/** A reference on the wire (routes/chatReferences.ts, ThreadView). `url` plays it through `/audio`. */
export interface ReferenceView {
  id: string;
  origin: 'upload' | 'library';
  name: string;
  sourceSongId: string | null;
  url: string;
  seconds: number | null;
  readTo: number; cut: boolean;
  /** A library song's layer count: more than 1 → only its base layer is read (D-137); null for an upload. */
  layers: number | null;
  /** The latest reading's time, null when not read; `readingNote` says why a stored one is unreadable. */
  readAt: string | null;
  readingNote: string | null;
  createdAt: string;
  /** What reading it again would cost, priced like the READ card (RE-ANALYZE's line, C3 live B). */
  estimate: ReadingEstimate;
}
