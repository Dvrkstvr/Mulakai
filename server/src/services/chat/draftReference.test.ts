/** The draft's reference marks (C3, F-063/F-064): kept on read, set by a reference recipe, cleared by a hand edit, locked on a cover. */
import { describe, it, expect } from 'vitest';
import { applyRecipe, emptyDraft, handEdit, readDraft } from './draftModel.js';
import type { Draft, Recipe, RecipeReference } from './chatTypes.js';

const RECIPE: Recipe = {
  title: 'Kopf hoch', style: 'synthpop', bpm: 120, key: 'Dm', time_signature: '4/4', language: 'de', engine: 'yue2',
  structure: ['Verse', 'Chorus'], lyrics: [{ tag: 'Verse', lines: ['a', 'b', 'c', 'd'] }, { tag: 'Chorus', lines: ['e', 'f', 'g', 'h'] }],
};
const borrow: RecipeReference = { referenceId: 'r1', use: 'borrow', borrowed: ['bpm', 'timeSignature', 'structure'], missing: ['key'], note: null };
const cover: RecipeReference = { ...borrow, use: 'cover', borrowed: ['bpm', 'key', 'timeSignature', 'structure'], missing: [] };
const noKey = (r: Recipe) => { const { key: _key, ...rest } = r; return rest as unknown as Recipe; };

describe('readDraft keeps the C3 marks (additive under draft_v 1)', () => {
  it('reads reference, borrowed and missing as written', () => {
    const d: Draft = { draft_v: 1, rev: 2, fields: { bpm: 120 }, touched: {}, reference: { referenceId: 'r1', use: 'cover' }, borrowed: ['bpm'], missing: ['key'] };
    expect(readDraft(JSON.stringify(d)).draft).toEqual(d);
  });

  it('drops a malformed reference and unknown field names, never a crash', () => {
    const raw = JSON.stringify({ draft_v: 1, rev: 1, fields: {}, touched: {}, reference: { referenceId: 7, use: 'cover' }, borrowed: ['bpm', 'mood', 3], missing: 'key' });
    expect(readDraft(raw).draft).toEqual({ draft_v: 1, rev: 1, fields: {}, touched: {}, borrowed: ['bpm'] });
  });
});

describe('applyRecipe with a reference', () => {
  it('trap (F-064 edge): a missing key is cleared from the draft, never left from an earlier card', () => {
    const before = applyRecipe(emptyDraft(), RECIPE, 0).draft; // key Dm from an earlier card
    const { draft, changed } = applyRecipe(before, noKey(RECIPE), 1, borrow);
    expect(draft.fields.key).toBeUndefined();
    expect(changed).toContain('key');
    expect(draft).toMatchObject({ reference: { referenceId: 'r1', use: 'borrow' }, borrowed: ['bpm', 'timeSignature', 'structure'], missing: ['key'] });
  });

  it('a borrowed field the person typed after SEND keeps the hand edit and loses its mark', () => {
    const sent = applyRecipe(emptyDraft(), RECIPE, 0).draft;
    const typed = handEdit(sent, { bpm: 90 }).draft;
    const { draft, skipped } = applyRecipe(typed, { ...RECIPE, bpm: 100 }, 1, borrow);
    expect(skipped).toEqual(['bpm']);
    expect(draft.fields.bpm).toBe(90);
    expect(draft.borrowed).toEqual(['timeSignature', 'structure']);
  });

  it('only the marks changing still writes a new rev', () => {
    const filled = applyRecipe(emptyDraft(), RECIPE, 0).draft;
    const { draft } = applyRecipe(filled, RECIPE, 1, cover);
    expect(draft.rev).toBe(filled.rev + 1);
    expect(draft.reference).toEqual({ referenceId: 'r1', use: 'cover' });
  });

  it('a recipe without a reference drops the marks of the card before', () => {
    const marked = applyRecipe(emptyDraft(), RECIPE, 0, cover).draft;
    const { draft } = applyRecipe(marked, { ...RECIPE, title: 'Neu' }, 1);
    expect(draft).not.toHaveProperty('reference');
    expect(draft).not.toHaveProperty('borrowed');
    expect(draft).not.toHaveProperty('missing');
  });
});

describe('handEdit on a reference draft', () => {
  it('a hand edit of a borrowed field clears its mark (it becomes YOURS); filling a missing one clears that mark', () => {
    const d = applyRecipe(emptyDraft(), noKey(RECIPE), 0, borrow).draft;
    const { draft, touched, refused } = handEdit(d, { bpm: 90, key: 'Am' });
    expect(touched).toEqual(['bpm', 'key']);
    expect(refused).toEqual([]);
    expect(draft.borrowed).toEqual(['timeSignature', 'structure']);
    expect(draft.missing).toEqual([]);
  });

  it('trap (F-063): a cover\'s tempo, key, meter and structure are locked; the edit is refused with the reason', () => {
    const d = applyRecipe(emptyDraft(), RECIPE, 0, cover).draft;
    const { draft, touched, refused } = handEdit(d, { bpm: 90, key: null, title: 'Mine' });
    expect(touched).toEqual(['title']);
    expect(draft.fields).toMatchObject({ bpm: 120, key: 'Dm', title: 'Mine' });
    expect(refused.map((r) => r.field)).toEqual(['bpm', 'key']);
    expect(refused[0].reason).toContain('FROM THE SCORE');
  });
});
