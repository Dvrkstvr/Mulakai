/**
 * How a mark limits an edit plan (D-176, F-055): the schema bounds bar-valued fields to the mark
 * (opSchema `barRange`); this checks a reply against it, so a reply that ignored the schema is retried:
 * a bar or phrase start outside the mark, a REPEAT / CUT of a section outside it, a REWRITE_LYRICS of a
 * block sung outside it. A whole-song op (tempo, key, style) stays allowed and the card says so; a mark
 * past the score's end is clamped and a phrase longer than the mark runs past it, each named on the card.
 * Pure.
 */
import type { Op, ScoreFacts, ScoreSection } from '../score/planTypes.js';

export type BarRange = [number, number];
export interface Fit { reasons: string[]; notes: string[] }

const WHOLE_SONG: Record<string, string> = { SET_TEMPO: 'SET TEMPO', TRANSPOSE: 'TRANSPOSE', EDIT_STYLE: 'EDIT STYLE' };
const kindOf = (tag: string) => tag.toLowerCase().split(' ')[0].replace(/^[[\]:]+|[[\]:]+$/g, '');
const span = ([a, b]: BarRange) => `bars ${a}-${b}`;
const disjoint = (s: ScoreSection, [a, b]: BarRange) => s.to_bar < a || s.from_bar > b;
const named = (s: ScoreSection) => `S${s.index} ${s.label} (bars ${s.from_bar}-${s.to_bar})`;

/** The mark's bars clamped to the score (null when it lies wholly past the end), with the reason when clamped. */
export function markBars([from, to]: BarRange, songBars: number): { range: BarRange | null; notes: string[] } {
  if (from > songBars) return { range: null, notes: [`the mark (bars ${from}-${to}) is past the end of the score (bar ${songBars})`] };
  if (to <= songBars) return { range: [from, to], notes: [] };
  return { range: [from, songBars], notes: [`the mark reaches bar ${to} but the score ends at bar ${songBars}: planned on bars ${from}-${songBars}`] };
}

function barsOf(o: Record<string, unknown>): number[] {
  if (o.op === 'REHARMONIZE') {
    const chords = Array.isArray(o.chords) ? o.chords.map((c) => (c as { bar?: unknown }).bar) : [];
    return [o.from_bar, o.to_bar, ...chords].filter((n): n is number => typeof n === 'number');
  }
  return o.op === 'WRITE_PHRASE' && typeof o.start_bar === 'number' ? [o.start_bar] : [];
}

/** The section that sings a lyric block: the k-th section of the block's kind (yue-server's rule, D-066 d). */
function singer(o: Record<string, unknown>, facts: ScoreFacts): ScoreSection | undefined {
  const block = facts.lyric_blocks.find((b) => b.index === o.block);
  return block && facts.sections.filter((s) => kindOf(s.label) === kindOf(block.tag))[block.occurrence - 1];
}

function opFit(o: Record<string, unknown>, at: string, range: BarRange, facts: ScoreFacts, notes: string[]): string[] {
  const outside = barsOf(o).find((n) => n < range[0] || n > range[1]);
  if (outside !== undefined) return [`${at}: bar ${outside} is outside the mark (${span(range)}); plan only inside it`];
  if (o.op === 'WRITE_PHRASE' && Array.isArray(o.bars) && typeof o.start_bar === 'number' && o.start_bar + o.bars.length - 1 > range[1]) {
    const n = o.bars.length;
    notes.push(`the phrase is ${n} bars, longer than the mark (${range[1] - range[0] + 1} bars): it starts at bar ${o.start_bar} and runs to bar ${o.start_bar + n - 1}`);
  }
  if (o.op === 'REPEAT' || o.op === 'CUT') {
    const s = facts.sections.find((x) => x.index === o.section);
    return s && disjoint(s, range) ? [`${at}: ${named(s)} is outside the mark (${span(range)})`] : [];
  }
  if (o.op === 'REWRITE_LYRICS') {
    const s = singer(o, facts);
    return s && disjoint(s, range) ? [`${at}: lyric block ${String(o.block)} is sung in ${named(s)}, outside the mark (${span(range)})`] : [];
  }
  return [];
}

export function markFit(ops: Op[], range: BarRange, facts: ScoreFacts): Fit {
  const notes: string[] = [];
  const reasons = ops.flatMap((op, i) => {
    const o = op as unknown as Record<string, unknown>;
    return opFit(o, `op ${i + 1} (${String(o.op)})`, range, facts, notes);
  });
  const whole = [...new Set(ops.map((o) => WHOLE_SONG[(o as { op: string }).op]).filter(Boolean))];
  if (whole.length) notes.push(`${whole.join(', ')} ${whole.length > 1 ? 'change' : 'changes'} the whole song, not only the marked bars`);
  return { reasons, notes };
}
