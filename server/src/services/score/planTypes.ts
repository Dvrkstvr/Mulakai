/** Types for the score planner (F-019, F-026, F-029..F-031): the M0 ops, WRITE_PHRASE and the M2 section ops,
 * yue-server's facts and apply reply, and a pending plan. Wire shapes keep yue-server's snake_case
 * (yue-server/score_edit_routes.py, score_section_models.py). */

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
  | { op: 'WRITE_PHRASE'; start_bar: number; instrument: string; bars: PhraseNote[][] }
  | { op: 'TRANSPOSE'; semitones: number }
  /** `section` is the read's S<n> (facts.sections[].index), `label` its label as a cross-check. */
  | { op: 'REPEAT' | 'CUT'; section: number; label: string }
  /** `block` is facts.lyric_blocks[].index; `tag` + `occurrence` the cross-check; same line count, no tags. */
  | { op: 'REWRITE_LYRICS'; block: number; tag: string; occurrence: number; lines: string[] };

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

/** REWRITE_LYRICS's verdict detail: the block it changed and its lines before and after (F-031 #1). */
export interface LyricDiff { block: number; tag: string; occurrence: number; old: string[]; new: string[] }

/** `note`: what a section op did with the lyrics (the unmatched-block rule, F-030 #3); `diff`: REWRITE_LYRICS's. */
export interface OpVerdict { index: number; op: string; ok: boolean; reason: string | null; note?: string | null; diff?: LyricDiff | null }

/** A section of the edited score with its length as YuE2 plays it (edited numbering, D-066 g). */
export interface AppliedSection extends ScoreSection { seconds: number }

/** POST /v1/scores/apply's reply. */
export interface ApplyResult {
  ok: boolean;
  abc: string;
  style: string;
  /** The edited lyrics; exactly the request's when no op changed them; null when none were sent. */
  lyrics?: string | null;
  verdicts: OpVerdict[];
  checks: { ok: boolean; problems: string[]; differences: string[] };
  changed: { abc: boolean; style: boolean; lyrics?: boolean };
  /** Null when the edited score does not parse. */
  sections?: AppliedSection[] | null;
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
  /** The edited lyrics the render sends; null/absent = the base version's stored lyrics. */
  lyrics?: string | null;
  checks: { bars: number; seconds: number | null; tokens: number | null; chordsPresent: boolean | null; changed: ApplyResult['changed'] };
  attempts: number;
  /** Each earlier refused attempt's reasons (planAttempts), shown in the review (D-060). */
  refusals: string[][];
  createdAt: number;
  /** What "this" meant, pinned when PLAN / REVISE was pressed (F-032, M2-3); null = the whole song. */
  referent?: Referent | null;
  /** 1 for a PLAN, the replaced plan's + 1 for a REVISE (F-033). */
  revision?: number;
  /** A REVISE's ops against the plan it replaced (F-033 #1, M2-6); null for a PLAN. */
  since?: Since | null;
}

/** A pick sent with PLAN (F-032): a strip section (S<n> of the read, its label, which occurrence of that
 * label, its bars) or a lyric line (block of the read, its tag and occurrence, the 1-based line). `of`: how
 * many of that label / kind the song had at the pick, so a stale pick is found again counting from the end
 * (a REPEAT or CUT before it shifts the count from the start, not from the end). */
export type ReferentInput =
  | { kind: 'section'; section: number; label: string; occurrence: number; of?: number; bars: [number, number] }
  | { kind: 'line'; block: number; tag: string; occurrence: number; of?: number; line: number; text?: string | null };

/** A pick checked against the score as read, numbered as it is now; a line carries the section that sings its
 * block, if any (Q-045). It is a valid ReferentInput, so the client can send it back (USE BARS, REVISE). */
export type Referent =
  | { kind: 'section'; section: number; label: string; occurrence: number; of: number; bars: [number, number] }
  | { kind: 'line'; block: number; tag: string; occurrence: number; of: number; line: number; text: string | null;
      section: number | null; label: string | null; bars: [number, number] | null };

/** A pick that no longer matches the score (Q-043, M2-4): `now` is where the same label + occurrence lives
 * now (sent back as the referent by USE BARS), null when it is gone. Nothing is planned against it. */
export interface StaleReferent { picked: ReferentInput; now: Referent | null; reason: string }

/** One press of the dock (planJob): PLAN (the whole song, or a pick) or REVISE of the pending plan with this id. */
export interface PlanPress { referent?: ReferentInput | null; revise?: string | null }

export type OpMark = 'NEW' | 'CHANGED' | 'SAME';

/** Per op of a revised plan, in order: its mark and the replaced plan's op it was matched to. */
export interface Since { planId: string; marks: Array<{ mark: OpMark; was: Op | null }>; removed: Op[] }

/** Why a plan run ended without a plan (planJob's PlanError): `check` = attempts spent, a limit
 * or a cut prompt; `offline` = the planner or yue-server could not be used; `refused` = the song
 * stopped being eligible; `cancelled` = CANCEL / ABORT. */
export type PlanCause = 'check' | 'offline' | 'refused' | 'cancelled';
