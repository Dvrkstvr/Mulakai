/**
 * The one draft (D-086), pure: read it from the raw stored blob, apply a hand edit, merge a
 * recipe. A field the person touched after SEND is skipped and named (CH-6, Q-057).
 * Shape only here; the rules a field must meet are recipeRules.ts. C3: the draft's reference marks
 * (`reference`, `borrowed`, `missing`): a reference recipe sets them and clears a missing field; a hand
 * edit of a borrowed field clears its mark, and a cover's score fields refuse a hand edit.
 */
import type { Draft, DraftField, DraftFields, DraftReference, LyricSection, Recipe, RecipeReference } from './chatTypes.js';

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
const fieldList = (v: unknown): DraftField[] | undefined =>
  (Array.isArray(v) ? DRAFT_FIELDS.filter((f) => v.includes(f)) : undefined);

/** The C3 marks of a stored draft; a malformed one is dropped. */
function readMarks(blob: Record<string, unknown>): Pick<Draft, 'reference' | 'borrowed' | 'missing'> {
  const r = blob.reference;
  const reference: DraftReference | undefined = isObject(r) && typeof r.referenceId === 'string' && (r.use === 'cover' || r.use === 'borrow')
    ? { referenceId: r.referenceId, use: r.use } : undefined;
  const marks = { reference, borrowed: fieldList(blob.borrowed), missing: fieldList(blob.missing) };
  return Object.fromEntries(Object.entries(marks).filter(([, v]) => v !== undefined));
}

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
  return { draft: { draft_v: DRAFT_V, rev: isRev(blob.rev) ? blob.rev : 0, fields: readFields(blob.fields), touched, ...readMarks(blob) }, note: null };
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

export const COVER_LOCKED = 'this is a cover: tempo, key, meter and structure come FROM THE SCORE of the reference; ask for a new song in its style to change them';
const locked = (draft: Draft, name: DraftField) => draft.reference?.use === 'cover' && (draft.borrowed ?? []).includes(name);
const without = (list: DraftField[] | undefined, names: DraftField[]) => list && list.filter((f) => !names.includes(f));

/** A sidebar edit. `patch` comes from the client: a key absent or undefined is unchanged, null
 * clears it, a mistyped value is ignored. Rev grows once when anything changed. A cover's locked
 * field is refused with the reason; an edited borrowed or missing field loses its mark. */
export function handEdit(draft: Draft, patch: Record<string, unknown>): { draft: Draft; touched: DraftField[]; refused: Array<{ field: DraftField; reason: string }> } {
  const next: Partial<Record<DraftField, unknown>> = {};
  const names: DraftField[] = [];
  const refused: Array<{ field: DraftField; reason: string }> = [];
  for (const name of DRAFT_FIELDS) {
    if (!(name in patch) || patch[name] === undefined) continue;
    if (locked(draft, name)) {
      refused.push({ field: name, reason: COVER_LOCKED });
      continue;
    }
    const v = patch[name] === null ? undefined : fieldValue(name, patch[name]);
    if (patch[name] !== null && v === undefined) continue;
    next[name] = v;
    names.push(name);
  }
  const { fields, changed } = merge(draft.fields, next, names);
  if (changed.length === 0) return { draft, touched: [], refused };
  const rev = draft.rev + 1;
  const touched = { ...draft.touched };
  for (const name of changed) touched[name] = rev;
  const marks = draft.reference ? { borrowed: without(draft.borrowed, changed), missing: without(draft.missing, changed) } : {};
  return { draft: { ...draft, rev, fields, touched, ...marks }, touched: changed, refused };
}

/** A recipe's values under the draft's field names. */
export function recipeFields(r: Recipe): DraftFields {
  return readFields({
    title: r.title, style: r.style, bpm: r.bpm, key: r.key, timeSignature: r.time_signature,
    language: r.language, structure: r.structure, lyrics: r.lyrics, engine: r.engine,
  });
}

/** Merge a checked recipe into the draft. `sentRev` is the draft's rev when the person sent the
 * message: a field touched by hand after it keeps the hand edit and is named in `skipped`. With a
 * `reference` (referenceRecipe), its missing fields are cleared and the marks set; without one, the
 * marks of an earlier card go. `before` (C2, UNDO TURN): each changed field's previous value, absent = was empty. */
export function applyRecipe(draft: Draft, recipe: Recipe, sentRev: number, reference?: RecipeReference | null): { draft: Draft; changed: DraftField[]; skipped: DraftField[]; before: Partial<DraftFields> } {
  const wanted = recipeFields(recipe) as Record<string, unknown>;
  const clear = reference?.missing ?? [];
  const skipped: DraftField[] = [];
  const names: DraftField[] = [];
  for (const name of DRAFT_FIELDS) {
    if ((wanted[name] === undefined && !clear.includes(name)) || same(draft.fields[name], wanted[name])) continue;
    if ((draft.touched[name] ?? -1) > sentRev) skipped.push(name);
    else names.push(name);
  }
  const { fields, changed } = merge(draft.fields, wanted, names);
  const before = Object.fromEntries(changed.filter((f) => draft.fields[f] !== undefined).map((f) => [f, draft.fields[f]])) as Partial<DraftFields>;
  const { reference: _r, borrowed: _b, missing: _m, ...rest } = draft;
  const marked: Draft = reference
    ? { ...rest, reference: { referenceId: reference.referenceId, use: reference.use }, borrowed: without(reference.borrowed, skipped), missing: without(reference.missing, skipped) }
    : rest;
  const marksSame = same([draft.reference, draft.borrowed, draft.missing], [marked.reference, marked.borrowed, marked.missing]);
  if (changed.length === 0 && marksSame) return { draft, changed, skipped, before };
  return { draft: { ...marked, rev: draft.rev + 1, fields }, changed, skipped, before };
}
