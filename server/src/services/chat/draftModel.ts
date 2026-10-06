/**
 * The one draft (D-086), pure: read it from the raw stored blob, apply a hand edit, merge a
 * recipe. A field the person touched after SEND is skipped and named (CH-6, Q-057).
 * Shape only here; the rules a field must meet are recipeRules.ts.
 */
import type { Draft, DraftField, DraftFields, LyricSection, Recipe } from './chatTypes.js';

export const DRAFT_V = 1;
export const DRAFT_FIELDS: DraftField[] = ['title', 'style', 'bpm', 'key', 'timeSignature', 'language', 'structure', 'lyrics', 'engine'];

export const emptyDraft = (): Draft => ({ draft_v: DRAFT_V, rev: 0, fields: {}, touched: {} });

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');
const isSection = (v: unknown): v is LyricSection => isObject(v) && typeof v.tag === 'string' && isStrings(v.lines);
const STRING_FIELDS = new Set<DraftField>(['title', 'style', 'key', 'timeSignature', 'language']);

/** One field's value if its shape is right, else undefined (dropped, never a crash). */
function fieldValue(name: DraftField, v: unknown): unknown {
  if (STRING_FIELDS.has(name)) return typeof v === 'string' ? v : undefined;
  if (name === 'bpm') return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  if (name === 'structure') return isStrings(v) ? [...v] : undefined;
  if (name === 'lyrics') return Array.isArray(v) && v.every(isSection) ? v.map((s) => ({ tag: s.tag, lines: [...s.lines] })) : undefined;
  return v === 'yue2' ? v : undefined; // engine: C0 creates on YuE2 only
}

function readFields(raw: unknown): DraftFields {
  const out: Record<string, unknown> = {};
  if (!isObject(raw)) return {};
  for (const name of DRAFT_FIELDS) {
    const v = fieldValue(name, raw[name]);
    if (v !== undefined) out[name] = v;
  }
  return out as DraftFields;
}

const isRev = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

/** draft_json -> Draft. The column default '{}' (v0) is an empty draft. An unknown `draft_v` or
 * unreadable JSON is an empty draft with a note saying so (versions-data.md). */
export function readDraft(raw: string | null | undefined): { draft: Draft; note: string | null } {
  let blob: unknown;
  try {
    blob = JSON.parse(raw || '{}');
  } catch {
    return { draft: emptyDraft(), note: 'the stored draft was not readable; starting an empty draft' };
  }
  if (!isObject(blob) || Object.keys(blob).length === 0) return { draft: emptyDraft(), note: null };
  if (blob.draft_v !== DRAFT_V) {
    return { draft: emptyDraft(), note: `the stored draft has draft_v ${String(blob.draft_v)}, which this server does not read; starting an empty draft` };
  }
  const touched: Draft['touched'] = {};
  if (isObject(blob.touched)) {
    for (const name of DRAFT_FIELDS) if (isRev(blob.touched[name])) touched[name] = blob.touched[name] as number;
  }
  return { draft: { draft_v: DRAFT_V, rev: isRev(blob.rev) ? blob.rev : 0, fields: readFields(blob.fields), touched }, note: null };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Set (or with undefined, clear) the fields in `next` that differ; returns the names changed. */
function merge(fields: DraftFields, next: Partial<Record<DraftField, unknown>>, names: DraftField[]): { fields: DraftFields; changed: DraftField[] } {
  const out: Record<string, unknown> = { ...fields };
  const changed: DraftField[] = [];
  for (const name of names) {
    if (same(out[name], next[name])) continue;
    if (next[name] === undefined) delete out[name];
    else out[name] = next[name];
    changed.push(name);
  }
  return { fields: out as DraftFields, changed };
}

/** A sidebar edit. `patch` comes from the client: a key absent or undefined is unchanged, null
 * clears it, a mistyped value is ignored. Rev grows once when anything changed. */
export function handEdit(draft: Draft, patch: Record<string, unknown>): { draft: Draft; touched: DraftField[] } {
  const next: Partial<Record<DraftField, unknown>> = {};
  const names: DraftField[] = [];
  for (const name of DRAFT_FIELDS) {
    if (!(name in patch) || patch[name] === undefined) continue;
    const v = patch[name] === null ? undefined : fieldValue(name, patch[name]);
    if (patch[name] !== null && v === undefined) continue;
    next[name] = v;
    names.push(name);
  }
  const { fields, changed } = merge(draft.fields, next, names);
  if (changed.length === 0) return { draft, touched: [] };
  const rev = draft.rev + 1;
  const touched = { ...draft.touched };
  for (const name of changed) touched[name] = rev;
  return { draft: { ...draft, rev, fields, touched }, touched: changed };
}

/** A recipe's values under the draft's field names. */
export function recipeFields(r: Recipe): DraftFields {
  return readFields({
    title: r.title, style: r.style, bpm: r.bpm, key: r.key, timeSignature: r.time_signature,
    language: r.language, structure: r.structure, lyrics: r.lyrics, engine: r.engine,
  });
}

/** Merge a checked recipe into the draft. `sentRev` is the draft's rev when the person sent the
 * message: a field touched by hand after it keeps the hand edit and is named in `skipped`. */
export function applyRecipe(draft: Draft, recipe: Recipe, sentRev: number): { draft: Draft; changed: DraftField[]; skipped: DraftField[] } {
  const wanted = recipeFields(recipe) as Record<string, unknown>;
  const skipped: DraftField[] = [];
  const names: DraftField[] = [];
  for (const name of DRAFT_FIELDS) {
    if (wanted[name] === undefined || same(draft.fields[name], wanted[name])) continue;
    if ((draft.touched[name] ?? -1) > sentRev) skipped.push(name);
    else names.push(name);
  }
  const { fields, changed } = merge(draft.fields, wanted, names);
  if (changed.length === 0) return { draft, changed, skipped };
  return { draft: { ...draft, rev: draft.rev + 1, fields }, changed, skipped };
}
