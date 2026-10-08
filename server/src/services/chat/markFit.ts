/**
 * How a mark limits an edit plan (D-176, F-055): the schema bounds bar-valued fields to the mark
 * (opSchema `barRange`); this checks a reply against it, so a reply that ignored the schema is retried:
 * a bar or phrase start outside the mark, a REPEAT / CUT of a section outside it, a REWRITE_LYRICS of a
 * block sung outside it. A whole-song op (tempo, key, style, any op with no bars) is refused too unless the
 * person's words ask for the whole song (`asksWholeSong`, C1 live B2: "make this jazzier" on a chorus planned
 * EDIT STYLE); when asked, it is allowed and the card says so. A mark past the score's end is clamped and a
 * phrase longer than the mark runs past it, each named on the card. A replan that dropped a refused whole-song op
 * but whose message still describes it gets a message from its own ops (`replanMessage`, C1 re-check N2); a start over that
 * left nothing says so and names it (`nothingPlanned`, D-257). Pure.
 */
import type { Op, ScoreFacts, ScoreSection } from '../score/planTypes.js';
import { sectionOf } from '../score/lyricPairing.js';

export type BarRange = [number, number];
export interface Fit { reasons: string[]; notes: string[] }

const WHOLE_SONG: Record<string, string> = { SET_TEMPO: 'SET TEMPO', TRANSPOSE: 'TRANSPOSE', EDIT_STYLE: 'EDIT STYLE' };
/** Ops a mark bounds by their bars or section; every other op changes the whole song. */
const BOUNDED = ['REHARMONIZE', 'WRITE_PHRASE', 'REPEAT', 'CUT', 'REWRITE_LYRICS'];
export const isWholeSongOp = (name: string): boolean => !BOUNDED.includes(name);
const opName = (name: string) => WHOLE_SONG[name] ?? name.replace(/_/g, ' ');

/** The person's words ask for a change to the whole song, not only the marked bars (assumed rule, C1 live B2). */
const WHOLE_WORDS = /\b(whole|entire|every ?where|throughout|all over|all of (it|the song|the track)|every (section|part|bar)|all (the )?(sections|parts|bars))\b/i;
export const asksWholeSong = (request: string): boolean => WHOLE_WORDS.test(request);

/** An assumption that names a place in the song ("assuming the first chorus, bars 15-22"). */
const PLACE_WORDS = /\b(bars?\s*\d+|intro|verse|pre-?chorus|chorus|bridge|outro|hook|breakdown|section|whole song)\b/i;
/** The card's assumptions under a mark (C1 live B3): the mark says where, so an assumed place is dropped. */
export const assumptionsUnderMark = (list: string[]): string[] => list.filter((a) => !PLACE_WORDS.test(a));
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
  return typeof o.block === 'number' ? sectionOf(facts, o.block) : undefined;
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

/** `wholeAsked`: the person asked for the whole song, so a whole-song op is allowed (with a note). */
export function markFit(ops: Op[], range: BarRange, facts: ScoreFacts, wholeAsked = false): Fit {
  const notes: string[] = [];
  const reasons = ops.flatMap((op, i) => {
    const o = op as unknown as Record<string, unknown>;
    const at = `op ${i + 1} (${String(o.op)})`;
    if (!wholeAsked && isWholeSongOp(String(o.op))) {
      return [`${at}: ${opName(String(o.op))} changes the whole song; the mark covers ${span(range)}, and a whole-song change needs the person to ask for it: plan only inside the mark`];
    }
    return opFit(o, at, range, facts, notes);
  });
  const whole = [...new Set(ops.map((o) => (o as { op: string }).op).filter(isWholeSongOp).map(opName))];
  if (whole.length) notes.push(`${whole.join(', ')} ${whole.length > 1 ? 'change' : 'changes'} the whole song, not only the marked bars`);
  return { reasons, notes };
}

/** What a message says when it describes a whole-song op (N2: "I will increase the tempo of the whole song"). */
const SAYS: Record<string, RegExp> = {
  SET_TEMPO: /\b(tempo|bpm|faster|slower|speed (it )?up|slow (it )?down)\b/i,
  TRANSPOSE: /\b(transpos\w*|semitones?|key change|change the key|new key)\b/i,
  EDIT_STYLE: /\b(style|genre)\b/i,
};
const REFUSED_WHOLE = /^op \d+ \((SET_TEMPO|TRANSPOSE|EDIT_STYLE)\): .* changes the whole song/;

function opWords(op: Op): string {
  switch (op.op) {
    case 'REHARMONIZE': return `new chords in ${span([op.from_bar, op.to_bar])}`;
    case 'WRITE_PHRASE': return `a ${op.instrument} phrase from bar ${op.start_bar}`;
    case 'REPEAT': case 'CUT': return `${op.op === 'REPEAT' ? 'repeat' : 'cut'} S${op.section} ${op.label}`;
    case 'REWRITE_LYRICS': return `new lyrics for ${op.tag} #${op.occurrence}`;
    default: return opName(op.op).toLowerCase();
  }
}

/** The whole-song ops a mark kept out: refused by an earlier attempt's check, or named by `asked` (the request),
 * and not among the accepted `ops`. */
function refusedWhole(ops: Op[], refusals: string[][], asked: string): string[] {
  const kept = new Set(ops.map((o) => o.op as string));
  const named = Object.keys(SAYS).filter((n) => SAYS[n].test(asked));
  return [...new Set([...refusals.flat().map((r) => REFUSED_WHOLE.exec(r)?.[1]).filter((n): n is string => Boolean(n)), ...named])]
    .filter((n) => !kept.has(n));
}

/** A start over that left nothing to plan (D-257, C2 live N1): says so, and under a mark (`asked`: the request, '' when
 * the person asked for the whole song or there is no mark) names the whole-song op the mark kept out. */
export function nothingPlanned(refusals: string[][], asked: string): string {
  const names = refusedWhole([], refusals, asked).map(opName);
  const whole = names.length ? ` ${names.join(', ')} ${names.length > 1 ? 'change' : 'changes'} the whole song; clear the mark to ask for it.` : '';
  return `Nothing planned: the earlier plan is scrapped.${whole}`;
}

/** The replan's message: as the model wrote it, unless a whole-song op was refused under the mark (by an earlier
 * attempt's check, or, `asked`: the request names it and the mark left it out of the schema, C2 live B2 (a)), the
 * accepted ops leave it out and the message still describes it; then one sentence from the accepted ops. */
export function replanMessage(message: string, ops: Op[], refusals: string[][], asked = ''): string {
  const stale = refusedWhole(ops, refusals, asked).filter((n) => SAYS[n].test(message));
  if (!stale.length) return message;
  const names = stale.map(opName).join(', ');
  return `Planned inside the mark: ${ops.map(opWords).join('; ')}. ${names} would change the whole song, so it is not in this plan; ask for the whole song to get it.`;
}
