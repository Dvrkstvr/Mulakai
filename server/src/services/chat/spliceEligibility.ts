/**
 * Which edit plans splice into the old take and which re-render the whole song (F-046 #2, F-047 edge,
 * F-065 edge, D-154): every op of a spliced kind (REHARMONIZE: A3; CUT and REPEAT: audio only),
 * on a 4/4 song with no meter change in the bar map (SP-4 tested 4/4 only), on a score with chords
 * (a chord-free REHARMONIZE changes the render mode for the whole song, D-132; the join is fitted on
 * the score's chords), and each span inside the song as read. One op splices its span; 2+ ops (C4,
 * F-069) chain when spliceSteps says so and answer `kind: 'several'` with the steps (from/to = first and
 * last bar touched, for readers that predate C4). Everything else renders the whole song, and the
 * reason says why. REPEAT's level-step fallback is decided at render time (CB-3), not here; a REPEAT of
 * the last section is not spliced at all: its last bar is the song's ending, so the copy has no groove
 * to join after (C1 N1, D-213).
 * Pure. Every number is the song as read (D-066).
 */
import type { Op, ScoreFacts } from '../score/planTypes.js';
import { opSpan, spliceSteps, type SpliceKind, type SpliceStep } from './spliceSteps.js';

export type { SpliceKind, SpliceStep } from './spliceSteps.js';
type Span = { splice: true; from_bar: number; to_bar: number };
export type Splice =
  | (Span & { kind: SpliceKind })
  /** C4 (D-266): a chain, `steps` last bar first. */
  | (Span & { kind: 'several'; steps: SpliceStep[] })
  | { splice: false; reason: string };
export interface SpliceInput {
  facts: Pick<ScoreFacts, 'header' | 'sections' | 'bar_map'>;
  /** The read's verdict on the base score (null = unknown, treated as none, as renderMode does). */
  chordsPresent: boolean | null;
  /** C4 feature gate (off until the chain ships end to end): off, 2+ ops answer main's single-change reason. */
  chain?: boolean;
}

const METER = '4/4';
const METER_LINE = /^\(meter M:(\d+\/\d+) from here/;
const no = (reason: string): Splice => ({ splice: false, reason });

export function spliceEligibility(ops: Op[], { facts, chordsPresent, chain = false }: SpliceInput): Splice {
  if (ops.length === 0 || (ops.length > 1 && !chain)) return no(`the plan makes ${ops.length} changes; only a single change can be spliced into the old take`);
  const spans = [];
  for (const op of ops) {
    const s = opSpan(op, facts.sections);
    if (typeof s === 'string') return no(s);
    spans.push(s);
  }
  if (facts.header.meter !== METER) return no(`the song is in ${facts.header.meter}; splicing is tested on ${METER} only`);
  const other = facts.bar_map.map((l) => METER_LINE.exec(l)?.[1]).find((m) => m && m !== METER);
  if (other) return no(`the meter changes to ${other} inside the song; splicing is tested on ${METER} only`);
  if (chordsPresent !== true) {
    return no(spans.some((s) => s.kind === 'reharmonize') ? 'the song has no chords: adding them renders the whole song with chords' : 'the song has no chords to align the join on');
  }
  for (const [i, s] of spans.entries()) {
    if (s.from < 1 || s.to > facts.header.bars || s.from > s.to) return no(`bars ${s.from}-${s.to} are not inside the song's ${facts.header.bars} bars`);
    const op = ops[i];
    if (op.op === 'REPEAT' && s.to === facts.header.bars) {
      return no(`the ${op.label} ends the song: its last bar is the ending, so the old audio has nothing to play the copy after`);
    }
  }
  if (spans.length === 1) return { splice: true, kind: spans[0].kind, from_bar: spans[0].from, to_bar: spans[0].to };
  const planned = spliceSteps(ops, facts);
  if ('reason' in planned) return no(planned.reason);
  const { steps } = planned;
  return { splice: true, kind: 'several', from_bar: steps.at(-1)!.from_bar, to_bar: steps[0].to_bar, steps };
}
