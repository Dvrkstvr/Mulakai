/** What a request asks of WRITE_PHRASE (F-026): how many bars (N, the schema's exact bar count)
 * and where a phrase may go (runs of N or more bars where the Vocal rests, read from the BAR
 * MAP's `V:rest`, the same runs yue-server names when it refuses). Pure. */
import { MAX_PHRASE_BARS } from './phraseSchema.js';
import type { ScoreFacts } from './planTypes.js';

/** "add a sax phrase" without a count: SP-2's phrase cases and the spec's example are 4 bars. */
export const DEFAULT_PHRASE_BARS = 4;

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
const COUNT = `(\\d+|${Object.keys(WORDS).join('|')})`;
const NOUN = '(?:phrase|line|solo|riff|lick|fill|melody|motif|hook|break)';
/** "4-bar sax phrase", "three bars of flute melody" / "a sax phrase of 6 bars". */
const BEFORE = new RegExp(`\\b${COUNT}[- ]?bars?\\b(?:[\\s-]+[\\w-]+){0,3}?[\\s-]+${NOUN}`, 'i');
const AFTER = new RegExp(`\\b${NOUN}\\b(?:[\\s-]+[\\w-]+){0,3}?[\\s-]+${COUNT}[- ]?bars?\\b`, 'i');

/** N for this request: the count tied to a phrase word, capped at yue-server's 8; else 4. A bare
 * bar count ("the last 8 bars") is a place, not a phrase length. */
export function phraseBarsOf(request: string): number {
  const word = (BEFORE.exec(request) ?? AFTER.exec(request))?.[1]?.toLowerCase();
  if (!word) return DEFAULT_PHRASE_BARS;
  const n = WORDS[word] ?? Number(word);
  if (!Number.isInteger(n) || n < 1) return DEFAULT_PHRASE_BARS;
  return Math.min(n, MAX_PHRASE_BARS);
}

/** Runs of at least `size` bars where the Vocal rests, as "a-b" (yue-server's `free:` list). */
export function freeRuns(barMap: string[], size: number): string[] {
  const runs: Array<[number, number]> = [];
  for (const line of barMap) {
    const m = /^(\d+): .*\| V:(rest|sung) \|/.exec(line);
    if (!m || m[2] !== 'rest') continue;
    const bar = Number(m[1]);
    const last = runs.at(-1);
    if (last && last[1] === bar - 1) last[1] = bar;
    else runs.push([bar, bar]);
  }
  return runs.filter(([a, b]) => b - a + 1 >= size).map(([a, b]) => (a === b ? String(a) : `${a}-${b}`));
}

/** The user-message lines that size a phrase and place it. */
export function phraseLines(facts: ScoreFacts, n: number): string[] {
  const free = freeRuns(facts.bar_map, n);
  return [
    `PHRASE LENGTH: a WRITE_PHRASE op has exactly ${n} bars`,
    `FREE BARS (the Vocal rests ${n} or more bars in a row; a phrase goes only here): `
      + (free.length ? free.join(', ') : `none, no ${n} bars in a row are free`),
  ];
}
