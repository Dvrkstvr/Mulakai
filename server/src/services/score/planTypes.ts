/** Types for the score planner (F-019, F-026): the M0 ops and WRITE_PHRASE, yue-server's facts and apply reply, and a
 * pending plan. Wire shapes keep yue-server's snake_case (yue-server/score_edit_routes.py). */

export const ROOTS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'] as const;
/** Upstream abc_tools' 15 native qualities; its major ("") is spelled `maj` in the op schema. */
export const QUALITIES = ['maj', 'm', 'dim', 'aug', '7', 'maj7', 'm7', 'dim7', 'm7b5', 'sus4', 'sus2', '6', 'm6', '7sus4', 'm(maj7)'] as const;

export type Root = (typeof ROOTS)[number];
export type Quality = (typeof QUALITIES)[number];

export interface ChordOp { bar: number; beat: number; root: Root; quality: Quality; bass?: Root }

/** One WRITE_PHRASE note: an ABC pitch (or z) and its length in quarter-note beats (F-026). */
export interface PhraseNote { pitch: string; beats: number }

export type Op =
  | { op: 'SET_TEMPO'; bpm: number }
  | { op: 'REHARMONIZE'; from_bar: number; to_bar: number; chords: ChordOp[] }
  | { op: 'EDIT_STYLE'; style: string }
  | { op: 'WRITE_PHRASE'; start_bar: number; instrument: string; bars: PhraseNote[][] };

export interface ScoreSection { index: number; label: string; from_bar: number; to_bar: number }

export interface LyricBlock { index: number; tag: string; occurrence: number; lines: number; first_line: string }

/** `facts` of POST /v1/scores/read: what the planner is told about the song. */
export interface ScoreFacts {
  header: { meter: string; unit: string; bpm: number; key: string; bars: number; seconds: number; units_per_quarter: number };
  key_notes: string;
  sections: ScoreSection[];
  lyric_blocks: LyricBlock[];
  bar_map: string[];
}

export interface OpVerdict { index: number; op: string; ok: boolean; reason: string | null }

/** POST /v1/scores/apply's reply. */
export interface ApplyResult {
  ok: boolean;
  abc: string;
  style: string;
  verdicts: OpVerdict[];
  checks: { ok: boolean; problems: string[]; differences: string[] };
  changed: { abc: boolean; style: boolean };
  chords_present: boolean | null;
  bpm: number | null;
  seconds: number | null;
  tokens: number | null;
}

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

/** One planner reply: the JSON text and how many prompt tokens the server says it read. */
export interface PlannerReply { content: string; promptTokens: number | null }

/** A plan waiting for review (planStore, D-035): never persisted. */
export interface Plan {
  id: string;
  songId: string;
  baseVersionId: string;
  /** scoreSource's fingerprint at plan time: APPLY & RENDER refuses when it changed (F-018 #3). */
  fingerprint: string;
  request: string;
  ops: Op[];
  verdicts: OpVerdict[];
  abc: string;
  style: string;
  checks: { bars: number; seconds: number | null; tokens: number | null; chordsPresent: boolean | null; changed: ApplyResult['changed'] };
  attempts: number;
  /** Each earlier refused attempt's reasons (planAttempts), shown in the review (D-060). */
  refusals: string[][];
  createdAt: number;
}

/** Why a plan run ended without a plan (planJob's PlanError): `check` = attempts spent, a limit
 * or a cut prompt; `offline` = the planner or yue-server could not be used; `refused` = the song
 * stopped being eligible; `cancelled` = CANCEL / ABORT. */
export type PlanCause = 'check' | 'offline' | 'refused' | 'cancelled';
