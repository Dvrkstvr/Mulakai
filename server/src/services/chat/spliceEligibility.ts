/**
 * Which edit plans splice into the old take and which re-render the whole song (F-046 #2, F-047 edge,
 * F-065 edge, D-154): exactly one op of a spliced kind (REHARMONIZE: A3; CUT and REPEAT: audio only),
 * on a 4/4 song with no meter change in the bar map (SP-4 tested 4/4 only), on a score with chords
 * (a chord-free REHARMONIZE changes the render mode for the whole song, D-132; the join is fitted on
 * the score's chords), and a span inside the song as read. Everything else renders the whole song,
 * and the reason says why. REPEAT's level-step fallback is decided at render time (CB-3), not here.
 * Pure. Every number is the song as read (D-066).
 */
import type { Op, ScoreFacts } from '../score/planTypes.js';

export type SpliceKind = 'reharmonize' | 'cut' | 'repeat';
export type Splice = { splice: true; kind: SpliceKind; from_bar: number; to_bar: number } | { splice: false; reason: string };
export interface SpliceInput {
  facts: Pick<ScoreFacts, 'header' | 'sections' | 'bar_map'>;
  /** The read's verdict on the base score (null = unknown, treated as none, as renderMode does). */
  chordsPresent: boolean | null;
}

const METER = '4/4';
const METER_LINE = /^\(meter M:(\d+\/\d+) from here/;
const no = (reason: string): Splice => ({ splice: false, reason });
const words = (op: string) => op.replace('_', ' ');

/** The op's span as read, or why it has none. */
function span(op: Op, facts: SpliceInput['facts']): { kind: SpliceKind; from: number; to: number } | string {
  if (op.op === 'REHARMONIZE') return { kind: 'reharmonize', from: op.from_bar, to: op.to_bar };
  if (op.op === 'CUT' || op.op === 'REPEAT') {
    const s = facts.sections.find((x) => x.index === op.section);
    return s ? { kind: op.op === 'CUT' ? 'cut' : 'repeat', from: s.from_bar, to: s.to_bar } : `section S${op.section} is not in the song as read`;
  }
  return `${words(op.op)} changes the whole take, so it cannot be spliced into the old one`;
}

export function spliceEligibility(ops: Op[], { facts, chordsPresent }: SpliceInput): Splice {
  if (ops.length !== 1) return no(`the plan makes ${ops.length} changes; only a single change can be spliced into the old take`);
  const [op] = ops;
  const s = span(op, facts);
  if (typeof s === 'string') return no(s);
  if (facts.header.meter !== METER) return no(`the song is in ${facts.header.meter}; splicing is tested on ${METER} only`);
  const other = facts.bar_map.map((l) => METER_LINE.exec(l)?.[1]).find((m) => m && m !== METER);
  if (other) return no(`the meter changes to ${other} inside the song; splicing is tested on ${METER} only`);
  if (chordsPresent !== true) {
    return no(s.kind === 'reharmonize' ? 'the song has no chords: adding them renders the whole song with chords' : 'the song has no chords to align the join on');
  }
  if (s.from < 1 || s.to > facts.header.bars || s.from > s.to) return no(`bars ${s.from}-${s.to} are not inside the song's ${facts.header.bars} bars`);
  return { splice: true, kind: s.kind, from_bar: s.from, to_bar: s.to };
}
