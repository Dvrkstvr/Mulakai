/** All C2 server types (architecture.md "Chat (C2)": Data and Wire contract): the edit card's bar map, the
 * lyrics panel in the analysis view, the recipe turn's undo record and the undo's result, and the pending plan
 * a revise turn builds on. CV-1..CV-3 and the client's wire types build on this one contract. Types only. */
import type { Plan } from '../score/planTypes.js';
import type { Draft, DraftField, DraftFields } from './chatTypes.js';

/* ---- The bar map (F-060, D-215): built on the server from the facts the planner saw. ---- */

/** A section of the song as read: its label, which occurrence of that label, its bars. */
export interface BarMapSection { label: string; occurrence: number; from: number; to: number }
/** One op's bars on the read (`[from, to]`, inclusive), or `whole` for a tempo, key or style op (hatched). */
export interface BarMapOp { spans: Array<[number, number]>; whole: boolean }
/** `ops[i]` is the card's op i. */
export interface BarMap { bars: number; sections: BarMapSection[]; ops: BarMapOp[] }

/* ---- The lyrics panel (F-056, D-217, D-218): `shown.lyrics` of the analysis view, computed at read time. ---- */

/** Where a line sits: a line of the stored lyrics `text` (a YuE2 block; the client aligns it to word timings),
 * a heard line's seconds (a transcribed version), or no time at all. */
export type PanelLineAt = { textLine: number } | { seconds: [number, number] } | null;
export interface PanelLine { n: number; text: string; at: PanelLineAt }
/** A strip section (`strip` = its score index) with the block it sings (null: none) and its lines. */
export interface PanelSection {
  strip: number;
  label: string;
  occurrence: number;
  bars: [number, number];
  seconds: [number, number] | null;
  block: number | null;
  lines: PanelLine[];
}
export interface PanelFacts { bpm: number; key: string; meter: string; style: string | null }
/** `source`: `blocks` (a YuE2 version's tagged lyrics), `heard` (transcribed lines), `none` (no words, `note`
 * says why). `text`: the stored lyrics `textLine` indexes into (null for `heard`); a mismatch is a note and no
 * lines, never a guess. */
export interface LyricsPanel {
  source: 'blocks' | 'heard' | 'none';
  note: string | null;
  text: string | null;
  facts: PanelFacts | null;
  sections: PanelSection[];
}

/* ---- UNDO TURN (F-059, D-220, D-221): a recipe turn's record, written with its merge. ---- */

/** `rev`: the draft's rev the merge wrote; `before`: each filled field's previous value (absent = was empty);
 * `fields`: the fields the turn filled. */
export interface RecipeUndo { rev: number; before: Partial<DraftFields>; fields: DraftField[] }
export interface UndoKept { field: DraftField; reason: string }
/** On the recipe body once undone (one undo per turn). */
export interface RecipeUndone { at: number; restored: DraftField[]; kept: UndoKept[] }
/** `draftUndo`'s answer: the restored draft and what was kept, or why the undo is refused (409). */
export type UndoResult =
  | { ok: true; draft: Draft; restored: DraftField[]; kept: UndoKept[] }
  | { ok: false; error: 'UNDO_REFUSED' | 'TURN_OPEN'; reason: string };

/* ---- REVISE (F-058, D-227): the live edit card's plan a turn revises. ---- */

/** `lines`: the PENDING PLAN block (`planRevise.pendingLines`); `count`: the pending op count `drop` numbers into. */
export interface RevisePending { plan: Plan; lines: string[]; count: number }
