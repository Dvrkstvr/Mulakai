/** The edit card's bar map (F-060, D-215): the facts the planner saw (sections, bar count) and each op's bars on
 * the song as read (every number in an op means the read, D-066). REHARMONIZE its bars, WRITE_PHRASE its start
 * and length, REPEAT / CUT its section, REWRITE LYRICS the section its block pairs with (`lyricPairing`), SET
 * TEMPO / TRANSPOSE / EDIT STYLE the whole song. A section or block not in the read marks no bars. Pure. */
import type { Op, ScoreFacts, ScoreSection } from '../score/planTypes.js';
import { sectionOf } from '../score/lyricPairing.js';
import type { BarMap, BarMapOp, BarMapSection } from './convergeTypes.js';

type Span = [number, number];

const sectionSpan = (s: ScoreSection | undefined): Span[] => (s ? [[s.from_bar, s.to_bar]] : []);

function opSpans(op: Op, facts: ScoreFacts): Span[] | 'whole' {
  switch (op.op) {
    case 'REHARMONIZE': return [[op.from_bar, op.to_bar]];
    case 'WRITE_PHRASE': return [[op.start_bar, op.start_bar + Math.max(1, op.bars.length) - 1]];
    case 'REPEAT': case 'CUT': return sectionSpan(facts.sections.find((s) => s.index === op.section));
    case 'REWRITE_LYRICS': return sectionSpan(sectionOf(facts, op.block));
    default: return 'whole';
  }
}

/** Spans cut to bars 1..bars; one wholly outside is dropped. */
const clamp = (spans: Span[], bars: number): Span[] =>
  spans.flatMap(([a, b]) => {
    const from = Math.max(1, a);
    const to = Math.min(bars, b);
    return from <= to ? [[from, to] as Span] : [];
  });

export function barMap(facts: ScoreFacts, ops: Op[]): BarMap {
  const bars = Math.max(facts.header.bars, 0, ...facts.sections.map((s) => s.to_bar));
  const seen = new Map<string, number>();
  const sections: BarMapSection[] = facts.sections.map((s) => {
    const occurrence = (seen.get(s.label) ?? 0) + 1;
    seen.set(s.label, occurrence);
    return { label: s.label, occurrence, from: s.from_bar, to: s.to_bar };
  });
  const mapped: BarMapOp[] = ops.map((op) => {
    const spans = opSpans(op, facts);
    return spans === 'whole' ? { spans: [], whole: true } : { spans: clamp(spans, bars), whole: false };
  });
  return { bars, sections, ops: mapped };
}
