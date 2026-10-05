/** The planner's op contract (F-019 #1, SP-2 "The op schema"): a strict JSON schema built per
 * song (bars 1..N, beats 1..beats-per-bar, sections 1..N and blocks 1..B, sectionSchema.ts) and per
 * request (a WRITE_PHRASE has exactly the N bars the request asks for, F-026) for `response_format`,
 * and the same bounds checked on a reply, one reason per op, so a retry can be told exactly what was
 * wrong. Pure. */
import { phraseOpSchema, phraseProblems } from './phraseSchema.js';
import { DEFAULT_PHRASE_BARS } from './phraseRequest.js';
import { sectionOpProblems, sectionOpSchemas } from './sectionSchema.js';
import { QUALITIES, ROOTS, type Op, type ScoreFacts } from './planTypes.js';

const OP_NAMES = ['SET_TEMPO', 'REHARMONIZE', 'EDIT_STYLE', 'WRITE_PHRASE', 'TRANSPOSE', 'REPEAT', 'CUT', 'REWRITE_LYRICS'] as const;
export const MAX_OPS = 6;
const BPM = { min: 40, max: 240 };
const STYLE_MAX = 1000;
const CHORDS_MAX = 96;

/** Quarter-note beats in the widest bar: the header meter and every meter change in the bar map. */
export function beatsPerBar(facts: ScoreFacts): number {
  const meters = [facts.header.meter, ...facts.bar_map.flatMap((l) => l.match(/M:(\d+\/\d+)/)?.[1] ?? [])];
  return Math.max(...meters.map((m) => {
    const [num, den] = m.split('/').map(Number);
    return num && den ? Math.ceil((num * 4) / den) : 4;
  }));
}

const int = (minimum: number, maximum: number) => ({ type: 'integer', minimum, maximum });
const op = (name: string, props: Record<string, unknown>) => ({
  type: 'object', additionalProperties: false, required: ['op', ...Object.keys(props)],
  properties: { op: { const: name }, ...props },
});

export function buildOpSchema(facts: ScoreFacts, phraseBars = DEFAULT_PHRASE_BARS): Record<string, unknown> {
  const bars = facts.header.bars;
  const chord = {
    type: 'object', additionalProperties: false, required: ['bar', 'beat', 'root', 'quality'],
    properties: {
      bar: int(1, bars), beat: int(1, beatsPerBar(facts)),
      root: { enum: [...ROOTS] }, quality: { enum: [...QUALITIES] }, bass: { enum: [...ROOTS] },
    },
  };
  return {
    type: 'object', additionalProperties: false, required: ['ops'],
    properties: {
      ops: {
        type: 'array', minItems: 1, maxItems: MAX_OPS,
        items: { anyOf: [
          op('SET_TEMPO', { bpm: int(BPM.min, BPM.max) }),
          op('REHARMONIZE', {
            from_bar: int(1, bars), to_bar: int(1, bars),
            chords: { type: 'array', items: chord, minItems: 1, maxItems: CHORDS_MAX },
          }),
          op('EDIT_STYLE', { style: { type: 'string', minLength: 1, maxLength: STYLE_MAX } }),
          phraseOpSchema(bars, phraseBars),
          ...sectionOpSchemas(facts),
        ] },
      },
    },
  };
}

export type OpsCheck = { ok: true; ops: Op[] } | { ok: false; reasons: string[] };

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function opProblems(o: Record<string, unknown>, facts: ScoreFacts, phraseBars: number): string[] {
  const bars = facts.header.bars;
  if (o.op === 'WRITE_PHRASE') return phraseProblems(o, bars, phraseBars);
  const sectionOp = sectionOpProblems(o, facts);
  if (sectionOp) return sectionOp;
  const inScore = (field: string, v: unknown) => (isInt(v) && v >= 1 && v <= bars ? []
    : [`${field} ${String(v)} is outside the score (bars 1-${bars})`]);
  if (o.op === 'SET_TEMPO') {
    return isInt(o.bpm) && o.bpm >= BPM.min && o.bpm <= BPM.max ? [] : [`bpm ${String(o.bpm)} is outside ${BPM.min}-${BPM.max}`];
  }
  if (o.op === 'EDIT_STYLE') {
    return typeof o.style === 'string' && o.style.trim() && o.style.length <= STYLE_MAX ? [] : [`style must be 1-${STYLE_MAX} characters`];
  }
  if (o.op !== 'REHARMONIZE') return [`not an op this editor knows (${OP_NAMES.join(', ')})`];
  const out = [...inScore('from_bar', o.from_bar), ...inScore('to_bar', o.to_bar)];
  if (isInt(o.from_bar) && isInt(o.to_bar) && o.to_bar < o.from_bar) out.push(`to_bar ${o.to_bar} is before from_bar ${o.from_bar}`);
  if (!Array.isArray(o.chords) || o.chords.length === 0) return [...out, 'chords must list at least one chord'];
  const beats = beatsPerBar(facts);
  for (const c of o.chords as unknown[]) {
    if (!obj(c)) { out.push('a chord is not an object {bar, beat, root, quality}'); continue; }
    out.push(...inScore('chord bar', c.bar));
    if (!isInt(c.beat) || c.beat < 1 || c.beat > beats) out.push(`chord beat ${String(c.beat)} is past the bar (beats 1-${beats})`);
    if (!ROOTS.includes(c.root as never)) out.push(`chord root ${String(c.root)} is not one of the ${ROOTS.length} roots`);
    if (!QUALITIES.includes(c.quality as never)) out.push(`chord quality ${String(c.quality)} is not one of the ${QUALITIES.length} qualities`);
    if (c.bass !== undefined && !ROOTS.includes(c.bass as never)) out.push(`chord bass ${String(c.bass)} is not one of the roots`);
  }
  return [...new Set(out)];
}

/** Checks a parsed reply against the song's bounds and the request's phrase length; reasons read
 * "op 2 (REHARMONIZE): ...". */
export function checkOps(reply: unknown, facts: ScoreFacts, phraseBars = DEFAULT_PHRASE_BARS): OpsCheck {
  if (!obj(reply) || !Array.isArray(reply.ops)) return { ok: false, reasons: ['the reply is not a JSON object {"ops":[...]}'] };
  const ops = reply.ops as unknown[];
  if (ops.length < 1 || ops.length > MAX_OPS) return { ok: false, reasons: [`the reply has ${ops.length} ops; send 1 to ${MAX_OPS}`] };
  const reasons = ops.flatMap((o, i) => {
    if (!obj(o)) return [`op ${i + 1}: not an object`];
    return opProblems(o, facts, phraseBars).map((p) => `op ${i + 1} (${String(o.op)}): ${p}`);
  });
  return reasons.length ? { ok: false, reasons } : { ok: true, ops: ops as Op[] };
}
