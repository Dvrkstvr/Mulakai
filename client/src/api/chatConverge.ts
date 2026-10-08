/** Chat C2 (F-056..F-060): the lyrics panel, the bar map and UNDO TURN on the wire, and the undo call. Mirrored by hand
 * from pipeline/architecture.md "Chat (C2)" → "Data (C2)" and "Wire contract (client ↔ server)", which the server's
 * `chat/convergeTypes.ts` (CV-0) builds on; reconcile both when either moves. `api/chat.ts` is at the cap, so the
 * recipe body's and message view's C2 fields extend its types here. All additive: older bodies have none of them. */
import type { ChatDraft, ChatDraftFields, ChatDraftKey, ChatMessageView, ChatRecipeBody } from './chat';
import { ApiError, json } from './http';

/** A panel line: `n` is its number in the section (1-based); `at` its time: a YuE2 line's index into `LyricsPanel.text`
 * (split on '\n', timed on the client by `alignLyrics`), a heard line's seconds, or null (not timed, D-218). */
export interface PanelLine { n: number; text: string; at: { textLine: number } | { seconds: [number, number] } | null }

/** One strip section (`strip` = the strip's S<n>) with the lyric block it sings (`block` null: none pairs) and its lines. */
export interface PanelSection {
  strip: number;
  label: string;
  occurrence: number;
  bars: [number, number];
  seconds: [number, number] | null;
  block: number | null;
  lines: PanelLine[];
}

/** `shown.lyrics`: `blocks` (a YuE2 version's stored words), `heard` (a transcribed version's lines), `none`; `note` says
 * why words are missing or unmatched; `text` is what `textLine` indexes (null for `heard`). */
export interface LyricsPanel {
  source: 'blocks' | 'heard' | 'none';
  note: string | null;
  text: string | null;
  facts: { bpm: number | null; key: string | null; meter: string | null; style: string | null } | null;
  sections: PanelSection[];
}

/** The edit card's bar map (`EditBody.map`, D-215): the song's sections as bands and, per op in order, its bar spans
 * (1-based, inclusive) or `whole` (SET TEMPO, TRANSPOSE, EDIT STYLE: drawn hatched). */
export interface BarMapSection { label: string; occurrence: number; from: number; to: number }
export interface BarMapOp { spans: Array<[number, number]>; whole: boolean }
export interface BarMap { bars: number; sections: BarMapSection[]; ops: BarMapOp[] }

/** The recipe body's undo record (D-220): the draft `rev` the reply wrote, each changed field's previous value (absent =
 * was empty) and the fields it filled. */
export interface RecipeUndo { rev: number; before: Partial<ChatDraftFields>; fields: ChatDraftKey[] }
export interface RecipeUndone { at: number; restored: ChatDraftKey[]; kept: Array<{ field: ChatDraftKey; reason: string }> }
export interface ChatRecipeBodyC2 extends ChatRecipeBody { undo?: RecipeUndo; undone?: RecipeUndone }

/** The message view's undo offer (`messageView`, CV-3): absent on older servers. */
export type UndoOffer = 'offer' | 'done' | null;
export type ChatMessageViewC2 = ChatMessageView & { undo?: UndoOffer };

export interface UndoDone { draft: ChatDraft; blockers: string[]; restored: ChatDraftKey[]; kept: RecipeUndone['kept'] }
export type UndoRefusal = 'UNDO_REFUSED' | 'TURN_OPEN';
export type UndoResult = UndoDone | { refused: string; code: UndoRefusal };

export const chatConvergeApi = {
  /** UNDO TURN: 200 the restored draft, 409 a refusal (nothing changed); 404 (unknown thread or message) throws. */
  undoTurn: async (threadId: string, messageId: string): Promise<UndoResult> => {
    const res = await fetch(`/api/chat/threads/${threadId}/messages/${messageId}/undo`, { method: 'POST' });
    if (res.status === 409) {
      const body = (await res.clone().json().catch(() => ({}))) as { error?: unknown; reason?: unknown };
      const code: UndoRefusal = body.error === 'TURN_OPEN' ? 'TURN_OPEN' : 'UNDO_REFUSED';
      if (body.error === 'TURN_OPEN' || body.error === 'UNDO_REFUSED') {
        return { refused: typeof body.reason === 'string' && body.reason ? body.reason : code, code };
      }
      throw new ApiError('HTTP 409', 409);
    }
    return json<UndoDone>(res);
  },
};
