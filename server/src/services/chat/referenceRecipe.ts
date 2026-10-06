/**
 * A recipe built on a read reference (D-128, F-063, F-064), pure: code, never the model, fills the
 * borrowed fields. `cover` takes tempo, key, meter and structure from the score itself (a cover sings
 * the score's own; locked, FROM THE SCORE) and lays the model's words out one entry per sung score
 * section; `borrow` takes them from `readingFacts` (ACE-Step first, then the score header; marked
 * REFERENCE). A value the reading lacks is removed from the recipe and named in `missing`: the
 * model's guess never stands in for it. A cover of a reading that cannot be covered becomes a borrow
 * with the reason. Score labels map to the closed tag list (unknown -> Verse).
 */
import { coverVerdict, readingFacts, type FactField, type Reading } from './reading.js';
import type { Draft, DraftField, LyricSection, Recipe, RecipeReference } from './chatTypes.js';

const TAGS: Record<string, string> = { intro: 'Intro', verse: 'Verse', prechorus: 'Pre-Chorus', chorus: 'Chorus', bridge: 'Bridge', outro: 'Outro' };
const DRAFT_NAME: Record<FactField, DraftField> = { bpm: 'bpm', key: 'key', meter: 'timeSignature', structure: 'structure' };
const RECIPE_NAME: Record<FactField, keyof Recipe> = { bpm: 'bpm', key: 'key', meter: 'time_signature', structure: 'structure' };
const NO_SECTIONS = 'no sections were found in the reference, so the structure is the assistant\'s';

/** `Verse 2` / `pre-chorus` / `CHORUS` -> a closed section tag; anything else is a Verse. */
export function sectionTag(label: string): string {
  return TAGS[label.toLowerCase().replace(/[^a-z]/g, '')] ?? 'Verse';
}

/** The model's sections laid out on `structure`: per sung place, the k-th model section of its tag
 * (the last one again when it wrote fewer), else the model's section at that place, retagged. */
function layOut(structure: string[], lyrics: LyricSection[]): LyricSection[] {
  const seen: Record<string, number> = {};
  const out: LyricSection[] = [];
  for (const tag of structure) {
    if (tag === 'Intro' || !lyrics.length) continue;
    const k = seen[tag] ?? 0;
    seen[tag] = k + 1;
    const same = lyrics.filter((s) => s.tag === tag);
    const pick = same.length ? same[Math.min(k, same.length - 1)] : { ...lyrics[Math.min(out.length, lyrics.length - 1)], tag };
    out.push({ tag: pick.tag, lines: [...pick.lines] });
  }
  return out;
}

export function referenceRecipe(model: Recipe, reading: Reading, referenceId: string): { recipe: Recipe; reference: RecipeReference | null } {
  const asked = model.reference_use;
  if (asked !== 'cover' && asked !== 'borrow') return { recipe: model, reference: null };
  const verdict = coverVerdict(reading);
  const use = asked === 'cover' && verdict.ok ? 'cover' : 'borrow';
  const notes = asked === 'cover' && !verdict.ok ? [`a cover is not possible: ${verdict.reason}; this is a new song in its style instead`] : [];
  const facts = readingFacts(reading, use === 'cover' ? 'score' : 'caption');
  const out: Record<string, unknown> = { ...model, reference_use: use };
  const borrowed: DraftField[] = [];
  const missing: DraftField[] = [];
  for (const f of ['bpm', 'key', 'meter'] as const) {
    if (facts[f] === null) {
      delete out[RECIPE_NAME[f]];
      missing.push(DRAFT_NAME[f]);
    } else {
      out[RECIPE_NAME[f]] = facts[f];
      borrowed.push(DRAFT_NAME[f]);
    }
  }
  if (facts.structure.length) {
    const structure = facts.structure.map(sectionTag);
    out.structure = structure;
    out.lyrics = layOut(structure, model.lyrics);
    borrowed.push('structure');
  } else notes.push(NO_SECTIONS);
  return { recipe: out as unknown as Recipe, reference: { referenceId, use, borrowed, missing, note: notes.join('; ') || null } };
}

/** Why CREATE COVER cannot run for this draft; empty for a draft that is not a cover. `ref` is the
 * draft's reference row as stored now (null when gone). */
export function coverBlockers(draft: Draft, ref: { id: string; reading: Reading | null } | null): string[] {
  if (draft.reference?.use !== 'cover') return [];
  if (!ref || ref.id !== draft.reference.referenceId) return ['the reference of this cover is gone: attach it again'];
  if (!ref.reading) return ['the reference has not been read: press READ first'];
  const verdict = coverVerdict(ref.reading);
  return verdict.ok ? [] : [`a cover is not possible: ${verdict.reason}`];
}
