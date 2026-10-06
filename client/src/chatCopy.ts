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
  structure: 'STRUCTURE', lyrics: 'LYRICS', engine: 'ENGINE',
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
  if (!phase || phase.kind === 'failed') return null;
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
