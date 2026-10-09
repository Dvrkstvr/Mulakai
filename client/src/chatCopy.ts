/** Every line the chat says (pipeline/design/chat-create.html frames 1a/1b/5, scope.md "A turn, end to end",
 * F-041, F-043, F-044). The chat's copy lives only here. Pure. */
import type { ChatDraftFields, ChatDraftKey, ChatLyricSection, ChatMessageState } from './api/chat';
import { MAX_TURN_ATTEMPTS, type CommitPhase, type TurnState } from './chatTurn';
import { queueSuffix, startsAfter } from './queueCopy';

export const SEND_LABEL = 'SEND ↵';
export const COMPOSER_PLACEHOLDER = 'Describe a song, or say what to change…';
export const NEW_CHAT = 'NEW CHAT';
export const CREATE_SONG = 'CREATE SONG';
export const FORM_LINK = 'FORM ▸';
export const ASSISTANT_TAG = 'ASSISTANT';
export const YOURS_TAG = 'YOURS';
export const RECIPE_HEADER = 'PROPOSAL · NEW SONG';
export const RECIPE_HINT = 'fields are in the FORM sidebar · nothing runs yet';
export const TURN_COST = 'uses the GPU, ~10 s · nothing runs yet';
export const FAILED_TAIL = 'Nothing changed; your draft and message are kept.';
export const ASSISTANT_OFF = 'ASSISTANT OFF';
export const ASSISTANT_OFF_TAIL = 'Guided Create works without it: FORM ▸';
export const CREATE_FAILED = 'CREATE FAILED';

export const FIELD_LABEL: Record<ChatDraftKey, string> = {
  title: 'TITLE', style: 'STYLE', bpm: 'TEMPO', key: 'KEY', timeSignature: 'METER', language: 'LANGUAGE',
  structure: 'STRUCTURE', lyrics: 'LYRICS', engine: 'ENGINE', vocals: 'VOCALS',
};
const ORDER = Object.keys(FIELD_LABEL) as ChatDraftKey[];
const labels = (keys: ChatDraftKey[]) => ORDER.filter((k) => keys.includes(k)).map((k) => FIELD_LABEL[k]);
const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0]);
const plural = (n: number, one: string, many = one === one.toUpperCase() ? `${one}S` : `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The reply line's "CHANGED · TEMPO, STYLE" (CH-4); null when the turn filled nothing. */
export function changedLine(keys: ChatDraftKey[]): string | null {
  return keys.length ? `CHANGED · ${labels(keys).join(', ')}` : null;
}

/** "skipped TITLE, you changed it" (CH-6, F-043): fields the person touched after SEND; null when none. */
export function skippedLine(keys: ChatDraftKey[]): string | null {
  if (!keys.length) return null;
  return `skipped ${and(labels(keys))}, you changed ${keys.length === 1 ? 'it' : 'them'}`;
}

/** The line under a running turn: "THINKING · QUEUED · STARTS AFTER 2 JOBS", "THINKING… attempt 2 of 3". */
export function turnLine(s: TurnState): string | null {
  const p = s.phase;
  if (s.cancelling && (p.kind === 'queued' || p.kind === 'thinking')) {
    return p.kind === 'queued' ? 'CANCELLING…' : 'CANCELLING · the planner unloads first';
  }
  switch (p.kind) {
    case 'sending': return 'SENDING…';
    case 'queued': return `THINKING · QUEUED · ${startsAfter(p.ahead).toUpperCase()}`;
    case 'thinking': return `THINKING… attempt ${p.attempt} of ${MAX_TURN_ATTEMPTS}`;
    case 'cancelled': return 'CANCELLED · no reply, nothing changed';
    case 'interrupted': return 'INTERRUPTED · the server restarted before the reply; send it again';
    default: return null;
  }
}

/** The retry's reason or the unload, in text-low under the thinking line. */
export const turnNote = (s: TurnState): string | null => (s.phase.kind === 'thinking' ? s.phase.note : null);

/** The failed line's title: three refused attempts, or what stopped the turn. */
export const failedTitle = (cause: string) => (cause === 'check' ? `NO ANSWER IN ${MAX_TURN_ATTEMPTS} ATTEMPTS` : 'THE TURN FAILED');

export const assistantOffLine = (cause: string) => `${ASSISTANT_OFF} · ${cause}`;

/** "Am" → "A MINOR", "F#" → "F# MAJOR" (yue-server's key names). */
export function keyName(key: string): string {
  const m = key.match(/^([A-G][#b]?)(m?)$/);
  return m ? `${m[1]} ${m[2] ? 'MINOR' : 'MAJOR'}` : key.toUpperCase();
}

export const lyricLineCount = (sections: ChatLyricSection[]) => sections.reduce((n, s) => n + s.lines.length, 0);

/** The recipe card's one summary line, from the live draft: "68 BPM · A MINOR · 4/4 · 38 LINES · YUE2". */
export function recipeSummary(f: ChatDraftFields): string {
  const lines = lyricLineCount(f.lyrics);
  return [
    f.bpm !== null ? `${f.bpm} BPM` : null, f.key ? keyName(f.key) : null, f.timeSignature,
    f.structure.length ? plural(f.structure.length, 'SECTION') : null, lines ? plural(lines, 'LINE') : null, 'YUE2',
  ].filter(Boolean).join(' · ');
}

/** CREATE SONG's consequence line (F-044): "Renders a new song on YuE2, about 3 min · uses the GPU · lands in
 * Library · nothing else changes", plus the queue while it is busy. No estimate, no length. */
export function recipeConsequence(estSeconds: number | null | undefined, ahead = 0): string {
  const length = estSeconds ? `, about ${Math.max(1, Math.round(estSeconds / 60))} min` : '';
  return `Renders a new song on YuE2${length} · uses the GPU · lands in Library · nothing else changes${queueSuffix(ahead)}`;
}

/** Why CREATE SONG is off, from the server's blockers (never re-checked here); null when it is live. */
export const blockersLine = (blockers: string[]) => (blockers.length ? `${CREATE_SONG} is off: ${blockers.join(' · ')}` : null);

/** A proposal card's state line; null while it is live (pending) or done. */
export function cardStateLine(state: ChatMessageState | null): string | null {
  if (state === 'superseded') return 'SUPERSEDED · a newer proposal replaced this one';
  if (state === 'expired') return 'EXPIRED · this proposal expired, ask again';
  return null;
}

/** The take's job line under the card (its button never turns into progress); a failure is `createFailedLine`. */
export function createJobLine(phase: CommitPhase | null): string | null {
  if (!phase || phase.kind === 'failed' || phase.kind === 'cancelled') return null;
  if (phase.kind === 'starting' || (phase.kind === 'queued' && phase.ahead <= 0)) return `${CREATE_SONG} · STARTING…`;
  if (phase.kind === 'queued') return `${CREATE_SONG} · QUEUED · ${startsAfter(phase.ahead).toUpperCase()}`;
  return `RENDERING ON YUE2${phase.progressText ? ` · ${phase.progressText}` : ''}`;
}

/** The take failed: the engine's error, and what is kept (F-044 edge). */
export const createFailedLine = (error: string) => `${error} · the draft and the thread are kept`;

/** The collapsed sidebar's rail (CH-3): "8 FIELDS FILLED". */
export const railLine = (filled: number) => (filled ? `${plural(filled, 'FIELD')} FILLED` : 'NO FIELDS YET');

/** NEW CHAT's consequence line (F-041 edge): "Drops this draft and its 3 messages · the Library is untouched". */
export function newChatConsequence(messages: number): string {
  return `Drops this draft${messages ? ` and its ${plural(messages, 'message')}` : ''} · the Library is untouched`;
}

// The CHAT screen (CA-6; pipeline/design/chat-turn.html TU-1..TU-10, chat-create frames 1a/1b/5).
export const NEW_SONG = 'NEW SONG';
export const DRAFT_SUBTITLE = 'DRAFT · NOT A SONG YET · LANDS IN LIBRARY';
export const songSubtitle = (number: number | null, length: string | null) =>
  [number ? `v${number}` : null, length, 'IN LIBRARY'].filter(Boolean).join(' · ');
export const EMPTY_THREAD = 'Describe a song: a mood, a style, a language, what it is about. The assistant fills the form beside the thread; nothing runs until CREATE SONG.';
export const QUEUED_TAIL = '· uses the GPU, about 10 s once it starts · nothing else changes';
export const CANCELLING = 'CANCELLING…';
export const CANCELLING_TAIL ='· unloading the planner so the GPU is free · nothing changes';
/** Under THINKING: the refused attempt's reason in the server's words, or the step (the unload; LD: the lyrics call). */
export const thinkingTail = (attempt: number, note: string | null) =>
  note ? (attempt > 1 && !/^(unloading|writing lyrics)\b/.test(note) ? `· attempt ${attempt - 1} refused: ${note}` : `· ${note}`) : null;
export const SEND_WAITS = 'SEND waits until the assistant answers · your text stays';
export const WAITING_FOR_V1 = 'WAITING FOR v1 · a message sent now is read after it saves';
export const WAITING_PLACEHOLDER = 'Waiting for the assistant…';
export const OFF_PLACEHOLDER = 'Assistant off · RETRY above, or use the form';
export const INTERRUPTED_LINE = 'The server restarted while this ran. Nothing changed.';
export const CANCELLED_LINE = 'CANCELLED · no reply · nothing changed';
/** The open turn's cancel (TU-2): the rust line's body beside its RETRY. */
export const CANCELLED_BODY = 'No reply. Nothing changed.';
export const offBody = (cause: string) => `${cause}. Guided Create works without it (FORM ▸); nothing carries over yet.`;
/** Frame 6: a field touched while the turn runs. */
export const touchedSinceSend = (keys: ChatDraftKey[]) =>
  keys.length ? `you changed ${and(labels(keys))} since sending · the assistant will skip ${keys.length === 1 ? 'it' : 'them'} and say so` : null;
export const SIDEBAR_HEAD = 'FORM · THE DRAFT';
export const SIDEBAR_RENDERING = 'FORM · RENDERING FROM THESE';
export const sidebarSongHead = (title: string) => `SONG · ${title.toUpperCase()}`;
export const SIDEBAR_FOOT = {
  empty: 'the assistant fills these from your message · nothing commits here',
  card: 'edit any · CREATE SONG is on the card ◂',
  /** The take waits behind another job: its line offers CANCEL. Once it starts nothing in the chat stops it. */
  lockedQueued: 'locked until v1 is saved or you CANCEL',
  locked: 'locked until v1 is saved',
  song: 'fields as rendered · read-only',
  off: 'nothing commits here · the form does',
} as const;
export const FILLING_TAG = 'FILLING…';
export const YOUR_EDIT = 'YOUR EDIT';
export const ENGINE_FIXED = 'YUE2 · FIXED';
export const COMMITTING_HINT = 'creating · the render is in the line below';
export const cardHeader = (kind: string, title?: string | null) =>
  kind === 'superseded' || kind === 'expired' ? `${RECIPE_HEADER} · ${kind.toUpperCase()}`
    : kind === 'done' && title ? `${RECIPE_HEADER} · ${title.toUpperCase()}` : RECIPE_HEADER;
export const EXPIRED_TITLE = 'THIS PROPOSAL EXPIRED';
export const LYRICS_TOGGLE = 'LYRICS';
/** F-097 (D-260): an instrumental draft, on the card (where the LYRICS toggle goes) and in the sidebar's LYRICS row. */
export const INSTRUMENTAL_LINE = 'INSTRUMENTAL · no vocals';
export const INSTRUMENTAL_FIELD = 'instrumental · no vocals';
export const INSTRUMENTAL_HINT = 'type lyrics to make it sung';
export const SUPERSEDED_BODY ='A newer proposal is below and its fields are in the sidebar. This one cannot be created.';
export const EXPIRED_BODY = 'when the server restarted. Your fields are still in the sidebar; ask again for a new card.';
export const ASK_AGAIN = 'ASK AGAIN';
export const ASK_AGAIN_TEXT = 'propose this again from the form as it is now';
/** A take cut at the length cap is saved, but never DONE (D-025): the header says TRUNCATED, the song card says why. */
export const doneLine = (number: number | null, truncated = false) => `${truncated ? 'TRUNCATED' : 'DONE'} · v${number ?? 1} SAVED`;
export const truncatedLine = (length: string | null, number: number) =>
  `TRUNCATED${length ? ` at ${length}` : ''}, the song is cut short · v${number} is saved; open it in the Editor to shorten and re-render`;
export const songCardMeta = (length: string | null) => [length, 'YUE2 · IN LIBRARY'].filter(Boolean).join(' · ');
export const OPEN_FAILED = "COULDN'T OPEN THE CHAT";
export const DROP_DRAFT = 'DROP DRAFT';
export const NEW_CHAT_REFUSED = 'NEW CHAT REFUSED · this chat is kept:';
export const KEEP = 'KEEP';
export const HIDE_SIDEBAR = 'HIDE ▸';
export const LIBRARY_LINK = 'LIBRARY ▸';
export const FOLD = 'FOLD ▴';
export const VERSIONS = 'VERSIONS';
export const NOT_SENT = 'NOT SENT';
export const notSentBody = (error: string) => `${error}. Your text is kept; SEND again.`;
export const LYRICS_HINT ='one [Verse] / [Chorus] header per section · saved when you leave the field';
