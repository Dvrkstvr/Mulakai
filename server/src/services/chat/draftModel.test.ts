/** The one draft (D-086): read from the raw stored blob, hand edits, and a recipe merged with the CH-6 skip rule. */
import { describe, it, expect } from 'vitest';
import { applyRecipe, emptyDraft, handEdit, readDraft, recipeFields } from './draftModel.js';
import type { Draft, Recipe } from './chatTypes.js';

const RECIPE: Recipe = {
  title: 'Luz sobre el mar', style: 'slow Spanish ballad, nylon guitar', bpm: 68, key: 'Am', time_signature: '4/4',
  language: 'es', engine: 'yue2', structure: ['Intro', 'Verse', 'Chorus'],
  lyrics: [{ tag: 'Verse', lines: ['a', 'b', 'c', 'd'] }, { tag: 'Chorus', lines: ['e', 'f', 'g', 'h'] }],
};

describe('readDraft: from the raw stored blob (draft_v rule, versions-data.md)', () => {
  it("reads the column default '{}' (v0, nothing written yet) as an empty draft with no note", () => {
    expect(readDraft('{}')).toEqual({ draft: emptyDraft(), note: null });
    expect(readDraft(null)).toEqual({ draft: emptyDraft(), note: null });
  });

  it('reads a v1 blob as written', () => {
    const d: Draft = { draft_v: 1, rev: 3, fields: { title: 'T', bpm: 90, lyrics: [{ tag: 'Verse', lines: ['x'] }] }, touched: { title: 2 } };
    expect(readDraft(JSON.stringify(d))).toEqual({ draft: d, note: null });
  });

  it('drops mistyped fields and unknown keys of a v1 blob instead of crashing', () => {
    const raw = JSON.stringify({ draft_v: 1, rev: 'x', fields: { title: 7, bpm: 90, mood: 'sad', lyrics: [{ tag: 1 }] }, touched: { bpm: 1, mood: 2 } });
    expect(readDraft(raw).draft).toEqual({ draft_v: 1, rev: 0, fields: { bpm: 90 }, touched: { bpm: 1 } });
  });

  it('trap: an unknown draft_v reads as an empty draft and says so, never a crash at start', () => {
    const { draft, note } = readDraft(JSON.stringify({ draft_v: 2, rev: 9, fields: { title: 'from the future' } }));
    expect(draft).toEqual(emptyDraft());
    expect(note).toMatch(/draft_v 2/);
  });

  it('a blob that is not JSON reads as an empty draft and says so', () => {
    expect(readDraft('{oops').note).toMatch(/not readable/);
    expect(readDraft('{oops').draft).toEqual(emptyDraft());
  });
});

describe('handEdit: the person edits a field in the sidebar', () => {
  it('bumps rev once and records the touched fields at the new rev', () => {
    const { draft, touched } = handEdit(emptyDraft(), { title: 'Mine', bpm: 100 });
    expect(draft.rev).toBe(1);
    expect(draft.fields).toEqual({ title: 'Mine', bpm: 100 });
    expect(draft.touched).toEqual({ title: 1, bpm: 1 });
    expect(touched).toEqual(['title', 'bpm']);
  });

  it('a value equal to the current one is no edit: no rev bump, nothing touched', () => {
    const start = handEdit(emptyDraft(), { title: 'Mine' }).draft;
    const again = handEdit(start, { title: 'Mine', structure: undefined });
    expect(again.draft).toBe(start);
    expect(again.touched).toEqual([]);
  });

  it('null clears a field; mistyped values and unknown keys are ignored', () => {
    const start = handEdit(emptyDraft(), { title: 'Mine', key: 'Am' }).draft;
    const { draft } = handEdit(start, { key: null, bpm: 'fast', mood: 'sad' });
    expect(draft.fields).toEqual({ title: 'Mine' });
    expect(draft.touched.key).toBe(2);
  });
});

describe('applyRecipe: a recipe merges into the draft (CH-6, Q-057)', () => {
  it('maps the recipe onto the fields (time_signature -> timeSignature)', () => {
    expect(recipeFields(RECIPE)).toMatchObject({ timeSignature: '4/4', key: 'Am', engine: 'yue2' });
  });

  it('fills an empty draft: every field changed, rev bumped once, nothing touched by hand', () => {
    const { draft, changed, skipped } = applyRecipe(emptyDraft(), RECIPE, 0);
    expect(changed).toEqual(['title', 'style', 'bpm', 'key', 'timeSignature', 'language', 'structure', 'lyrics', 'engine']);
    expect(skipped).toEqual([]);
    expect(draft.rev).toBe(1);
    expect(draft.touched).toEqual({});
  });

  it('skipped TITLE, you changed it: a field touched after SEND keeps the hand edit', () => {
    const sent = applyRecipe(emptyDraft(), RECIPE, 0).draft; // rev 1, SEND at rev 1
    const typed = handEdit(sent, { title: 'My own title' }).draft; // rev 2, while the turn runs
    const { draft, changed, skipped } = applyRecipe(typed, { ...RECIPE, title: 'Another', bpm: 60 }, 1);
    expect(skipped).toEqual(['title']);
    expect(changed).toEqual(['bpm']);
    expect(draft.fields.title).toBe('My own title');
    expect(draft.fields.bpm).toBe(60);
    expect(draft.rev).toBe(3);
  });

  it('a field edited by hand before SEND may be changed by the reply', () => {
    const typed = handEdit(emptyDraft(), { title: 'Draft title' }).draft; // rev 1
    const { draft, skipped } = applyRecipe(typed, RECIPE, 1);
    expect(skipped).toEqual([]);
    expect(draft.fields.title).toBe(RECIPE.title);
  });

  it('a touched field the recipe leaves equal is neither changed nor skipped; nothing new keeps rev', () => {
    const filled = applyRecipe(emptyDraft(), RECIPE, 0).draft;
    const typed = handEdit(filled, { bpm: 70 }).draft;
    const { draft, changed, skipped } = applyRecipe(typed, { ...RECIPE, bpm: 70 }, 1);
    expect([changed, skipped]).toEqual([[], []]);
    expect(draft).toBe(typed);
  });

  it('C2 (F-059, D-220): `before` holds each changed field\'s previous value; a field that was empty is absent', () => {
    const typed = handEdit(emptyDraft(), { title: 'Draft title', bpm: 70 }).draft; // rev 1
    const { before, changed } = applyRecipe(typed, { ...RECIPE, bpm: 70 }, 1);
    expect(changed).toContain('title');
    expect(changed).not.toContain('bpm');
    expect(before).toEqual({ title: 'Draft title' }); // bpm unchanged; style, key ... were empty
  });

  it('C2: `before` is empty when nothing changed, and leaves out a skipped field', () => {
    const sent = applyRecipe(emptyDraft(), RECIPE, 0).draft;
    const typed = handEdit(sent, { title: 'Mine' }).draft;
    expect(applyRecipe(typed, RECIPE, 1).before).toEqual({});
    const { before, skipped } = applyRecipe(typed, { ...RECIPE, title: 'Other', bpm: 60 }, 1);
    expect(skipped).toEqual(['title']);
    expect(before).toEqual({ bpm: RECIPE.bpm });
  });

  it('C2: a reference recipe that clears a missing field records the old value', () => {
    const typed = handEdit(emptyDraft(), { key: 'Dm' }).draft;
    const { before, changed } = applyRecipe(typed, { ...RECIPE, key: undefined } as unknown as Recipe, 1,
      { referenceId: 'r1', use: 'borrow', borrowed: [], missing: ['key'], note: null });
    expect(changed).toContain('key');
    expect(before.key).toBe('Dm');
  });

  it('an engine other than yue2 is not taken into the draft (C0 creates on YuE2 only)', () => {
    expect(recipeFields({ ...RECIPE, engine: 'acestep' }).engine).toBeUndefined();
  });
});
