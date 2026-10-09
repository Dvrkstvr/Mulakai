/**
 * RE-TIME as a chat op (RT-6, F-094; design/retime.html D1-D5): the planner's RETIME `{mode, bpm?}` in an edit's ops,
 * checked and routed in code (`routeRetime`), never by the model. Alone in a plan (Q-132), or the reply goes back with
 * the reason. HALF, DOUBLE or a BPM far from the read → the dock's plan or the reading's re-time, resolved after the
 * unload (turnRetime); a BPM within 8 % of the read → a SET TEMPO edit that says why (Q-125); refused → a say with the
 * reason. A turn whose words name the reading re-times the reading when there is one (`ABOUT_READING`, D-280). Pure.
 */
import type { Op } from '../score/planTypes.js';
import type { RetimeDoneBody } from './editTypes.js';
import { routeRetime, type RetimeAsk, type VerbFacts, type VerbRoute } from './retimeVerb.js';

type Schema = Record<string, unknown>;
export type RetimeRoute = Extract<VerbRoute, { kind: 'dock' | 'reading' }>;
export type RetimeChecked = { fail: string } | { say: string } | { tempo: Op; message: string } | { route: RetimeRoute };

/** The one prompt line (in the OPS block, only on a song thread). RT-6 re-check 1: "read it twice as fast as it is" was
 * DOUBLE 3 of 3 live, so the wrong-way words say the mode corrects the reading (HALF 3 of 3 with the clause). */
export const RETIME_RULE = 'RETIME {mode: half | double | bpm, bpm}: ONLY when the person says the tempo was READ wrong ("it\'s half '
  + 'time", "it\'s really 92 BPM"): half or double the tempo read, or the bpm they name; "read too fast / twice as fast" = half. '
  + 'Alone in ops; a tempo change is SET_TEMPO.';
export const RETIME_ALONE = 'RETIME stands alone: send only the RETIME op (every bar moves under the other ops); offer the rest after it';
/** D-278: a dock RE-TIME (or its slight SET TEMPO) replaces the song's plan, so over a pending one it needs a start over. */
export const RETIME_PENDING = 'an edit plan is pending; apply or scrap it first, or say start over';
export const ABOUT_READING =/\b(reading|read as|transcri\w*)\b/i;

/** RETIME is offered only on a song with something to re-time: a cover's transcription (offered or refused with why) or
 * a transcribed reading; a YuE2 original's prompt and schema stay as they were (its tempo is SET TEMPO's). */
export const offersRetime = (f: VerbFacts | null | undefined): f is VerbFacts => Boolean(f && (f.dock.state !== 'none' || f.reading));

const obj = (properties: Schema): Schema => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
/** HALF / DOUBLE carry no number; a BPM is any whole number, so one out of range is refused with the reason, not reshaped. */
export const retimeOpSchemas = (): Schema[] => [
  obj({ op: { const: 'RETIME' }, mode: { enum: ['half', 'double'] } }),
  obj({ op: { const: 'RETIME' }, mode: { const: 'bpm' }, bpm: { type: 'integer', minimum: 1, maximum: 999 } }),
];

export const refusedLine = (reason: string) => `Cannot re-time: ${reason}${/nothing changed/.test(reason) ? '' : ' · nothing changed'}.`;
const sentence = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
const isRetime = (o: unknown) => (o as { op?: unknown } | null)?.op === 'RETIME';

function askOf(o: { mode?: unknown; bpm?: unknown }): RetimeAsk | null {
  if (o.mode === 'half' || o.mode === 'double') return { mode: o.mode };
  return o.mode === 'bpm' && typeof o.bpm === 'number' && Number.isFinite(o.bpm) ? { mode: 'bpm', bpm: o.bpm } : null;
}

/** Null when no op is a RETIME. `facts`: what the song offers (null: no song or none read). */
export function checkRetime(ops: unknown[], facts: VerbFacts | null | undefined, request: string): RetimeChecked | null {
  if (!ops.some(isRetime)) return null;
  if (ops.length > 1) return { fail: RETIME_ALONE };
  const ask = askOf(ops[0] as { mode?: unknown; bpm?: unknown });
  if (!ask) return { fail: 'RETIME needs mode half or double, or mode bpm with a whole-number bpm' };
  if (!facts) return { say: refusedLine('this song has no transcription to re-time') };
  const route = routeRetime(ask, facts, ABOUT_READING.test(request) ? 'reading' : undefined);
  if (route.kind === 'refused') return { say: refusedLine(route.reason) };
  if (route.kind === 'set_tempo') return { tempo: { op: 'SET_TEMPO', bpm: route.bpm }, message: sentence(route.why) };
  return { route };
}

const MODE = { half: 'HALF TIME', double: 'DOUBLE TIME', bpm: 'BPM' } as const;
/** The reading route's reply (D4), in the dock's RE-TIME detail words (`scoreCopy.retimeDetail`). */
export function retimeDoneLine(r: RetimeDoneBody['retime']): string {
  const lost = r.droppedNotes ? ` ${r.droppedNotes} of ${r.notes} notes are left out of the score.` : '';
  return `Re-timed the reading of v${r.number}: ${MODE[r.mode]} · ${r.fromBpm} → ${r.bpm} BPM · ${r.fromBars} → ${r.toBars} bars, `
    + `same seconds. Bar numbers changed, so a mark on v${r.number} is stale.${lost}`;
}

/** RT-6 re-check 2: the history line of a reading re-time that was undone (`now`: the stored reading back as read, at the
 * stamp UNDO restores, nothing re-timed), else null. Its own text kept "65 → 130 BPM" in the prompt as if still true, and
 * the same words again became a new song (NEW CHAT), 9 of 9 live; with this line, no new song in 30 and RETIME in 26 (a
 * line naming the BPMs again drew SET_TEMPO or a new song). */
export function undoneLine(r: RetimeDoneBody['retime'], now: { readAt: string; retimed: boolean } | null): string | null {
  if (!now || now.retimed || now.readAt !== r.asReadAt) return null;
  return `[UNDONE: the person undid this turn's re-time of the reading of v${r.number}]`;
}

/** The reply's op for a routed RETIME, until the dock's plan replaces it (the reading route writes no op). */
export const routedOp = (r: RetimeRoute): Op =>
  ({ op: 'RETIME', mode: r.mode, bpm: r.bpm ?? 0, from_bpm: r.readBpm, dropped_notes: 0, notes: 0 });
