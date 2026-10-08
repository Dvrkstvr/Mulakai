/**
 * The strict JSON schema of one turn reply (SP-5 schemas.py turn_schema): `anyOf` the allowed actions.
 * Recipe enums and bounds come from recipeRules; an edit's ops are the SCORE planner's own
 * `opsArraySchema` (dummy 300-bar bounds without a song, as SP-5). No field carries ABC
 * (docs/decisions/0002). Pure.
 */
import { opsArraySchema } from '../score/opSchema.js';
import { dropSchema } from '../score/reviseReply.js';
import type { ScoreFacts } from '../score/planTypes.js';
import { BPM, ENGINES, KEYS, LANGUAGES, RECIPE_LIMITS, SECTION_TAGS, TIME_SIGNATURES } from './recipeRules.js';
import type { ScalpelKind, TurnAction } from './chatTypes.js';
import { isWholeSongOp } from './markFit.js';

type Schema = Record<string, unknown>;
const str = (minLength: number, maxLength: number): Schema => ({ type: 'string', minLength, maxLength });
const int = (minimum: number, maximum: number): Schema => ({ type: 'integer', minimum, maximum });
const arr = (items: Schema, minItems: number, maxItems: number): Schema => ({ type: 'array', items, minItems, maxItems });
const obj = (properties: Record<string, Schema>): Schema => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const action = (name: TurnAction, props: Record<string, Schema>) => obj({ action: { const: name }, ...props });

export const SCALPEL_KINDS: ScalpelKind[] = ['repaint', 'add_layer', 'split', 'export'];
export const MESSAGE_MAX = 400;
export const SAY_MAX = 600;

/** No song yet: an edit still has a shape (SP-5's NO_SONG_FACTS). */
export const NO_SONG_FACTS: ScoreFacts = {
  header: { meter: '4/4', unit: '1/8', bpm: 120, key: 'C', bars: 300, seconds: 0, units_per_quarter: 2 },
  key_notes: '', sections: [], lyric_blocks: [], bar_map: [],
};

/** C3 (D-128): how a recipe uses the read reference. */
export const REFERENCE_USES = ['cover', 'borrow', 'none'];

/** `reference`: the thread has a reading, so the recipe also says how it uses it. */
export function recipeSchema(reference = false): Schema {
  return obj({
    ...(reference ? { reference_use: { enum: REFERENCE_USES } } : {}), // first: decided before the lyrics (CP-C3)
    title: str(1, RECIPE_LIMITS.title), style: str(3, RECIPE_LIMITS.style), bpm: int(BPM.min, BPM.max), key: { enum: KEYS },
    time_signature: { enum: TIME_SIGNATURES }, language: { enum: LANGUAGES }, engine: { enum: ENGINES },
    structure: arr({ enum: SECTION_TAGS }, RECIPE_LIMITS.structure.min, RECIPE_LIMITS.structure.max), // LD: no lyrics (D-234, D-252)
  });
}

/** `barRange` (C1, D-176): a mark's bars, clamped to the song; an edit's bar-valued fields stay inside it, and a
 * whole-song op (tempo, key, style) is left out unless `wholeSong`: the person asked for the whole song (C1 live B2). */
export interface SchemaInput {
  facts: ScoreFacts | null; phraseBars: number; allowed: TurnAction[]; reference?: boolean; barRange?: [number, number] | null; wholeSong?: boolean;
  /** C2 (F-058, D-227): the pending plan's op count; an edit then revises it: `drop` + only what changes (ops may be empty). */
  pendingCount?: number;
}

function editOps(facts: ScoreFacts | null, phraseBars: number, barRange: [number, number] | null | undefined, wholeSong: boolean, minItems: number): Schema {
  const ops = opsArraySchema(facts ?? NO_SONG_FACTS, phraseBars, minItems, barRange ?? undefined) as { items: { anyOf: Schema[] } };
  if (!barRange || wholeSong) return ops;
  const names = (o: Schema) => { const p = (o as { properties: { op: { const?: string; enum?: string[] } } }).properties.op; return p.enum ?? [p.const ?? '']; };
  const bounded = ops.items.anyOf.filter((o) => !names(o).every(isWholeSongOp));
  return { ...ops, items: { anyOf: bounded } };
}

export function turnSchema({ facts, phraseBars, allowed, reference = false, barRange, wholeSong = false, pendingCount }: SchemaInput): Schema {
  const assumptions = arr(str(1, 160), 0, 4);
  const drop: Record<string, Schema> = pendingCount ? { drop: dropSchema(pendingCount) } : {};
  const parts: Record<TurnAction, () => Schema> = {
    ask: () => action('ask', { message: str(1, MESSAGE_MAX), choices: arr(str(1, 80), 2, 4) }),
    recipe: () => action('recipe', { message: str(1, MESSAGE_MAX), assumptions, recipe: recipeSchema(reference) }),
    edit: () => action('edit', { message: str(1, MESSAGE_MAX), assumptions, ...drop, ops: editOps(facts, phraseBars, barRange, wholeSong, pendingCount ? 0 : 1) }),
    scalpel: () => action('scalpel', { message: str(1, MESSAGE_MAX), kind: { enum: SCALPEL_KINDS }, target: str(1, 80), details: str(0, 300) }),
    analyze: () => action('analyze', { message: str(1, MESSAGE_MAX), reference: str(1, 120), plan: str(1, 300) }),
    say: () => action('say', { message: str(1, SAY_MAX) }),
  };
  const order: TurnAction[] = ['ask', 'recipe', 'edit', 'scalpel', 'analyze', 'say'];
  const list = order.filter((a) => allowed.includes(a)).map((a) => parts[a]());
  return list.length === 1 ? list[0] : { anyOf: list };
}
