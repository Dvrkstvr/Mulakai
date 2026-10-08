/** RE-TIME's rules and copy (PLAN.md "Re-time a Transcription", design/retime.html, D-209..D-212). A re-time
 * always starts from what SheetSage2 read, never from an earlier re-time, so a lossy half time is never halved
 * again; the chips name what the reading becomes. Pure: values in, answers out. */
import type { RetimeResult } from './api';

export const MIN_BPM = 40;
export const MAX_BPM = 240;
/** A BPM this close to the reading is a tempo nudge (SET TEMPO), not a wrong beat (Q-125). */
export const SLIGHT = 0.08;
/** Above this share of dropped notes the consequence warns (D-210). */
export const DROP_WARN = 0.1;

export type RetimeChoice = { mode: 'half' } | { mode: 'double' } | { mode: 'bpm'; bpm: number };

export const targetBpm = (read: number, c: RetimeChoice) =>
  c.mode === 'half' ? read / 2 : c.mode === 'double' ? read * 2 : c.bpm;

const inRange = (bpm: number) => Math.round(bpm) >= MIN_BPM && Math.round(bpm) <= MAX_BPM;

/** Why HALF or DOUBLE is off for this reading (Q-129, A7), or null when it is offered. */
export function chipBlocked(read: number, mode: 'half' | 'double'): string | null {
  const bpm = Math.round(targetBpm(read, { mode }));
  if (inRange(bpm)) return null;
  return `${mode === 'half' ? 'HALF' : 'DOUBLE'} is off: ${bpm} BPM is ${bpm < MIN_BPM ? 'under' : 'over'} the limit`;
}

/** A typed BPM: a whole number in 40-240, or the reason it is not. */
export function readTypedBpm(text: string): { bpm: number } | { why: string } {
  const t = text.trim();
  if (!t) return { why: 'type a BPM' };
  if (!/^\d+$/.test(t)) return { why: `${t} is not a whole number` };
  const bpm = Number(t);
  return inRange(bpm) ? { bpm } : { why: `${bpm} BPM IS OUTSIDE ${MIN_BPM}–${MAX_BPM}` };
}

/** True when a named BPM is only a little off the reading: the beat is right (Q-125, A3). */
export const slightlyOff = (read: number, bpm: number) => Math.abs(bpm / read - 1) <= SLIGHT;

const n = (x: number) => Math.round(x);

/** The consequence line before RE-TIME (DESIGN.md: before every generative commit), from the rebuilt score. */
export function retimeConsequence(fromBars: number, r: RetimeResult): string {
  const lost = r.droppedNotes > 0
    ? ` · ${r.droppedNotes} of ${r.notes} notes are too short for the slower grid and are left out` : ' · every note kept';
  return `Rebuilds the score at ${n(r.bpm ?? 0)} BPM: ${fromBars} bars → ${r.measures} · from the saved reading, no GPU${lost}`
    + ' · the piano preview is not redrawn · UNDO returns to the reading';
}

/** The consequence line on a chat reading (RT-5, design/retime.html B2): the bars renumber and a mark goes stale. */
export function readingRetimeConsequence(fromBars: number, r: RetimeResult): string {
  const lost = r.droppedNotes > 0 ? ` · ${r.droppedNotes} of ${r.notes} notes are left out of the score` : '';
  return `Re-times the reading at ${n(r.bpm ?? 0)} BPM: ${fromBars} bars → ${r.measures}, every bar number changes · from the saved`
    + ` reading, no GPU, a few seconds${lost} · a mark on this version goes stale: mark again · nothing is saved to your library`;
}

/** The slightly-off hint on a chat reading: the beat is right; nothing in the chat nudges a reading's tempo. */
export const readingSlightHint = (read: number, bpm: number) =>
  `${bpm} is within ${n(SLIGHT * 100)} % of the ${n(read)} read: the beat is right, the tempo is just a little off. RE-TIME is for a wrong beat.`;

export const dropsMany = (r: RetimeResult) => r.notes > 0 && r.droppedNotes / r.notes > DROP_WARN;

/** The slightly-off hint (A3): the cover panel has no SET TEMPO (Q-130). */
export const slightHint = (read: number, bpm: number) =>
  `${bpm} is within ${n(SLIGHT * 100)} % of the ${n(read)} read: the beat is right, the tempo is just a little off. RE-TIME is for a`
  + ' wrong beat. SET TEMPO in the SCORE dock nudges it once the cover exists.';

/** What a refusal says, by the server's code. */
export function retimeRefusal(code: string, message: string): string {
  if (code === 'no_bundle') return 'THE SAVED READING IS GONE · RE-TIME rebuilds from the transcription\'s saved outputs and these were cleared. Nothing changed.';
  if (code === 'out_of_range') return `${message.toUpperCase()} · nothing changed`;
  return `COULD NOT RE-TIME · ${message} · nothing changed`;
}
