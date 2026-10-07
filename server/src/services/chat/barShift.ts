/**
 * Did a version move its bars against its base (D-180)? The one rule behind the strip's dim vs hatched and a
 * stale mark, pure. A score plan of REHARMONIZE, SET TEMPO, TRANSPOSE, EDIT STYLE, REWRITE LYRICS and WRITE
 * PHRASE keeps every bar's number (seconds may change: they are re-timed when the new reading lands); one CUT or
 * REPEAT moves the bars after its section by the section's length (REPEAT copies a section right after itself,
 * yue-server score_sections.py), its span from the splice record or the base's sections; a repaint keeps the
 * timeline. A retake, regenerate, new take, ACE-Step take, import, truncated render or anything unknown moves
 * the bars by an unknown amount (`shift: null`, no USE BARS).
 */
import type { ScoreSection } from '../score/planTypes.js';
import type { BarShift, Shift } from './analysisTypes.js';

export interface ShiftInput {
  /** The version's parsed `params_json` (anything: unknown shapes move with no shift). */
  params: unknown;
  /** The base version's sections as read, for a CUT / REPEAT that was rendered whole. */
  baseSections?: ScoreSection[] | null;
}

const KEEPS = new Set(['REHARMONIZE', 'SET_TEMPO', 'TRANSPOSE', 'EDIT_STYLE', 'REWRITE_LYRICS', 'WRITE_PHRASE']);
const MOVES = new Set(['CUT', 'REPEAT']);
const KEPT: BarShift = { moved: false };
const UNKNOWN: BarShift = { moved: true, shift: null };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isSpan = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n));

function shiftOf(kind: 'CUT' | 'REPEAT', [from, to]: [number, number]): Shift {
  const length = to - from + 1;
  return { atBar: to + 1, delta: kind === 'CUT' ? -length : length };
}

/** The moving op's span: the splice record's bars when it spliced that kind, else its section in the base. */
function moveSpan(op: Record<string, unknown>, splice: unknown, base: ScoreSection[] | null | undefined): [number, number] | null {
  if (isObject(splice) && splice.kind === String(op.op).toLowerCase() && isSpan(splice.bars)) return splice.bars;
  const s = base?.find((x) => x.index === op.section);
  return s && s.label === op.label ? [s.from_bar, s.to_bar] : null;
}

export function barShift({ params, baseSections }: ShiftInput): BarShift {
  if (!isObject(params)) return UNKNOWN;
  if (params.task_type === 'repaint') return KEPT;
  if (params.score_v === undefined || !Array.isArray(params.ops) || params.truncated === true) return UNKNOWN;
  const ops = params.ops.filter(isObject);
  if (ops.length !== params.ops.length || ops.some((o) => !KEEPS.has(o.op as string) && !MOVES.has(o.op as string))) return UNKNOWN;
  const moves = ops.filter((o) => MOVES.has(o.op as string));
  if (!moves.length) return KEPT;
  if (moves.length > 1) return UNKNOWN;
  const span = moveSpan(moves[0], params.splice, baseSections);
  return { moved: true, shift: span ? shiftOf(moves[0].op as 'CUT' | 'REPEAT', span) : null };
}

/** Shifts along a chain of versions (oldest first): the bars kept, one known move, or moved by an unknown amount. */
export function composeShifts(chain: BarShift[]): BarShift {
  const moved = chain.filter((s): s is Extract<BarShift, { moved: true }> => s.moved);
  if (!moved.length) return KEPT;
  return moved.length === 1 ? moved[0] : UNKNOWN;
}
