/** WRITE_PHRASE's op shape for the planner (F-026 #1): bars are arrays of {pitch, beats} notes,
 * exactly N of them (N per request, phraseRequest.ts); never an ABC string. PITCH, BEATS and the
 * size caps are yue-server's (score_phrase.py, score_edit_routes.py), which writes the ABC, owns
 * units, ties and bar sums, and refuses with the numbers; this only checks the shape. Pure. */

/** An ABC pitch as upstream reads it (accidental, letter, up to two octave marks of one kind) or z. */
export const PITCH = "^(?:z|(?:\\^|_|=)?[A-Ga-g](?:,{1,2}|'{1,2})?)$";
export const BEATS = [0.5, 1, 1.5, 2, 3, 4] as const;
export const MAX_PHRASE_BARS = 8;
const MAX_NOTES = 16;
const INSTRUMENT_MAX = 40;
const PITCH_RE = new RegExp(PITCH);
const ABC_REFUSED = 'bars are arrays of {pitch, beats} notes; ABC strings are not accepted';

export function phraseOpSchema(songBars: number, n: number): Record<string, unknown> {
  const note = {
    type: 'object', additionalProperties: false, required: ['pitch', 'beats'],
    properties: { pitch: { type: 'string', pattern: PITCH }, beats: { enum: [...BEATS] } },
  };
  return {
    type: 'object', additionalProperties: false, required: ['op', 'start_bar', 'instrument', 'bars'],
    properties: {
      op: { const: 'WRITE_PHRASE' },
      start_bar: { type: 'integer', minimum: 1, maximum: Math.max(1, songBars - n + 1) },
      instrument: { type: 'string', minLength: 1, maxLength: INSTRUMENT_MAX },
      bars: { type: 'array', minItems: n, maxItems: n, items: { type: 'array', minItems: 1, maxItems: MAX_NOTES, items: note } },
    },
  };
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

function noteProblems(note: unknown, where: string): string[] {
  if (!note || typeof note !== 'object' || Array.isArray(note)) return [`${where}: a note is not an object {pitch, beats}`];
  const { pitch, beats } = note as Record<string, unknown>;
  const out: string[] = [];
  if (typeof pitch !== 'string' || !PITCH_RE.test(pitch)) {
    out.push(`${where}: pitch ${JSON.stringify(pitch)} is not an ABC pitch (a letter A-G or a-g, optional ^ _ =, optional , or '; z for a rest)`);
  }
  if (!BEATS.includes(beats as never)) out.push(`${where}: beats ${String(beats)} is not one of ${BEATS.join(', ')}`);
  return out;
}

/** Shape problems of one WRITE_PHRASE op against the song's bars and the N bars asked for. */
export function phraseProblems(o: Record<string, unknown>, songBars: number, n: number): string[] {
  const out: string[] = [];
  if (!isInt(o.start_bar) || o.start_bar < 1 || o.start_bar > songBars) {
    out.push(`start_bar ${String(o.start_bar)} is outside the score (bars 1-${songBars})`);
  }
  if (typeof o.instrument !== 'string' || !o.instrument.trim() || o.instrument.length > INSTRUMENT_MAX) {
    out.push(`instrument must be 1-${INSTRUMENT_MAX} characters`);
  }
  const bars = o.bars;
  if (typeof bars === 'string' || (Array.isArray(bars) && bars.some((b) => typeof b === 'string'))) return [...out, ABC_REFUSED];
  if (!Array.isArray(bars)) return [...out, `bars must be an array of ${n} bars of notes`];
  if (bars.length !== n) out.push(`the phrase has ${bars.length} bars; the request asks for ${n}`);
  else if (isInt(o.start_bar) && o.start_bar >= 1 && o.start_bar + n - 1 > songBars) {
    out.push(`a ${n}-bar phrase at bar ${o.start_bar} runs past the last bar (${songBars})`);
  }
  bars.forEach((bar, i) => {
    const where = `bar ${i + 1} of the phrase`;
    if (!Array.isArray(bar)) out.push(`${where} is not an array of notes`);
    else if (bar.length < 1 || bar.length > MAX_NOTES) out.push(`${where} has ${bar.length} notes; write 1-${MAX_NOTES}`);
    else out.push(...bar.flatMap((note) => noteProblems(note, where)));
  });
  return [...new Set(out)];
}
