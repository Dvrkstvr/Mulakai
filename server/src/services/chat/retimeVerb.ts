/**
 * Where a chat RE-TIME request goes (RT-6 prep, F-094; design/retime.html D1-D5). The planner asks for HALF, DOUBLE
 * or a BPM; this decides, in code, what the card does. A cover still on its transcription gets the dock's plan
 * (`makeRetimePlan`, F-093: YuE2 re-renders). A song that is not a cover, or a turn about the reading, re-times the
 * playable version's transcribed reading (F-092: no render). A BPM within 8 % of the read is a tempo nudge (Q-125):
 * SET TEMPO where a score can be edited, refused on a reading only. Anything else is refused with the reason.
 * Pure: the offers in (score/retimeOffer for the dock, retimeRecord for the reading), the route out. Not wired into a
 * turn yet: RT-6 does that after C2 (D-208).
 */
import type { RetimeOffer as DockOffer } from '../score/retimeOffer.js';
import type { RetimeOffer as ReadingOffer } from './retimeRecord.js';

export type RetimeAsk = { mode: 'half' } | { mode: 'double' } | { mode: 'bpm'; bpm: number };
export interface VerbFacts { dock: DockOffer; reading: ReadingOffer | null }
export type VerbRoute =
  | { kind: 'dock' | 'reading'; mode: RetimeAsk['mode']; bpm: number | null; readBpm: number }
  | { kind: 'set_tempo'; bpm: number; readBpm: number; why: string }
  | { kind: 'refused'; reason: string };

/** The same band and limits as the client's `retimeRules` (Q-125, Q-129). */
export const SLIGHT = 0.08;
export const MIN_BPM = 40;
export const MAX_BPM = 240;
export const READING_GONE_CHAT = 'the saved reading is gone: TRANSCRIBE AGAIN under the reading line, then ask again';
export const OWN_SCORE = "this song's score is what YuE2 rendered, so its beat is right by construction: SET TEMPO changes its tempo";

const r = Math.round;
const refused = (reason: string): VerbRoute => ({ kind: 'refused', reason });

const target = (mode: 'half' | 'double', read: number) => r(mode === 'half' ? read / 2 : read * 2);
const fits = (bpm: number) => bpm >= MIN_BPM && bpm <= MAX_BPM;

/** RT-6 re-check 3 (D-289): the planner's direction is unreliable for wrong-way words, so a HALF / DOUBLE off the
 * limits names the other mode when that one fits, in code. Never flipped: the person says it. */
function limits(ask: RetimeAsk, read: number): string | null {
  if (ask.mode === 'bpm') return r(ask.bpm) < MIN_BPM || r(ask.bpm) > MAX_BPM ? `${r(ask.bpm)} BPM is outside ${MIN_BPM}-${MAX_BPM}` : null;
  const bpm = target(ask.mode, read);
  if (fits(bpm)) return null;
  const off = `${ask.mode === 'half' ? 'HALF' : 'DOUBLE'} is off: ${bpm} BPM is ${bpm < MIN_BPM ? 'under' : 'over'} the limit`;
  const other = ask.mode === 'half' ? 'double' : 'half';
  if (!fits(target(other, read))) return off;
  return `${off} · nothing changed. Did you mean ${other} time (${r(read)} → ${target(other, read)} BPM)? Say "${other} time"`;
}

export function routeRetime(ask: RetimeAsk, facts: VerbFacts, about?: 'reading'): VerbRoute {
  const { dock, reading } = facts;
  // D-280: words about the reading pick the reading only when there is one; a cover with none means its transcription.
  const onReading = dock.state === 'none' || (about === 'reading' && reading !== null);
  if (!onReading) {
    if (dock.state === 'refused') return refused(dock.reason);
  } else if (!reading) {
    return refused(OWN_SCORE);
  } else if (!reading.notationId) {
    return refused(READING_GONE_CHAT);
  }
  const read = onReading ? reading!.read.bpm : (dock as Extract<DockOffer, { state: 'offered' }>).readBpm;
  const bpm = ask.mode === 'bpm' ? ask.bpm : null;
  const over = limits(ask, read);
  if (over) return refused(over);
  if (bpm !== null && Math.abs(bpm / read - 1) <= SLIGHT) {
    const slight = `${r(bpm)} is within ${r(SLIGHT * 100)} % of the ${r(read)} read: the beat is right`;
    return onReading ? refused(`${slight}, and RE-TIME is for a wrong beat · nothing changed`)
      : { kind: 'set_tempo', bpm: r(bpm), readBpm: read, why: `${slight}, so this is a tempo change, not a re-time` };
  }
  return { kind: onReading ? 'reading' : 'dock', mode: ask.mode, bpm, readBpm: read };
}
