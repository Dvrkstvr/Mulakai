/** F-097 (D-260): an instrumental draft through the rules, the draft and CREATE SONG. Pure. */
import { describe, it, expect } from 'vitest';
import { RECIPE } from '../../../test-fakes/chatScripts.js';
import { buildYue2Request, INSTRUMENTAL_LYRICS } from '../engines/yue2.js';
import { draftFields } from './draftFields.js';
import { applyRecipe, emptyDraft, handEdit, readDraft, recipeFields } from './draftModel.js';
import { createBlockers, recipeProblems } from './recipeRules.js';
import { namesVocals } from './asksForLyrics.js';
import { wireFields } from './messageView.js';

const instrumental = { ...RECIPE, vocals: 'instrumental' as const, lyrics: [] };
const env = { yueConfigured: true };

describe('recipeRules: an instrumental needs no lines, a sung recipe still does', () => {
  it('recipeProblems', () => {
    expect(recipeProblems(instrumental)).toEqual([]);
    expect(recipeProblems({ ...RECIPE, lyrics: [] })).toContain('no lyrics: write the sung sections');
    expect(recipeProblems({ ...instrumental, lyrics: RECIPE.lyrics })).toContain('an instrumental has no lyrics');
  });

  it('createBlockers: no lyrics blocker for an instrumental; an empty-lyrics sung draft blocks (never a silent instrumental)', () => {
    expect(createBlockers(recipeFields(instrumental), env)).toEqual([]);
    const blocker = 'LYRICS are empty: write the words, or ask for an instrumental';
    expect(createBlockers({ ...recipeFields(RECIPE), lyrics: [] }, env)).toContain(blocker);
    expect(createBlockers({ ...recipeFields(RECIPE), lyrics: undefined, vocals: undefined }, env)).toContain(blocker);
    expect(createBlockers(recipeFields(RECIPE), env)).toEqual([]);
  });
});

describe('the draft remembers vocals (additive under draft_v 1)', () => {
  it('a recipe sets it, a stored draft reads it back, a malformed value is dropped', () => {
    const { draft } = applyRecipe(emptyDraft(), instrumental, 0);
    expect(draft.fields).toMatchObject({ vocals: 'instrumental' });
    expect(draft.fields.lyrics ?? []).toEqual([]);
    expect(readDraft(JSON.stringify(draft)).draft.fields.vocals).toBe('instrumental');
    expect(readDraft(JSON.stringify({ ...draft, fields: { ...draft.fields, vocals: 'hummed' } })).draft.fields.vocals).toBeUndefined();
    expect(recipeFields(RECIPE).vocals).toBe('sung');
    expect(applyRecipe(draft, RECIPE, 1).changed).toContain('vocals');
  });

  it('typing lyrics into an instrumental draft makes it sung; clearing them leaves it instrumental', () => {
    const { draft } = applyRecipe(emptyDraft(), instrumental, 0);
    const typed = handEdit(draft, { lyrics: [{ tag: 'Verse', lines: ['eins zwei drei vier'] }] });
    expect(typed.draft.fields.vocals).toBe('sung');
    expect(typed.touched).toEqual(expect.arrayContaining(['lyrics', 'vocals']));
    expect(handEdit(draft, { lyrics: [] }).draft.fields.vocals).toBe('instrumental');
  });

  it('the wire shows it, absent = sung', () => {
    expect(wireFields(recipeFields(instrumental)).vocals).toBe('instrumental');
    expect(wireFields({}).vocals).toBe('sung');
  });
});

describe('CREATE SONG of an instrumental draft', () => {
  it('sends YuE2 the structure as a tags-only skeleton and an instrumental, no-vocals style', () => {
    const { fields } = draftFields(recipeFields(instrumental));
    expect(fields.lyrics).toBe('[Intro]\n\n[Verse]\n\n[Chorus]\n\n[Verse]\n\n[Chorus]\n\n[Outro]\n');
    const body = buildYue2Request(fields, () => 1);
    expect(body.lyrics).toBe(fields.lyrics);
    expect(String(body.style)).toMatch(/^Instrumental, Spanish, slow ballad/);
    expect(String(body.style)).toContain('no vocals');
  });

  it('a skeleton or blank lyrics on YuE2 are instrumental; a sung line is not', () => {
    expect(buildYue2Request({ prompt: 'lofi', lyrics: '' }, () => 1)).toMatchObject({ lyrics: INSTRUMENTAL_LYRICS });
    expect(String(buildYue2Request({ prompt: 'lofi', lyrics: '[Verse]\n\n[Chorus]\n' }, () => 1).style)).toContain('no vocals');
    expect(String(buildYue2Request({ prompt: 'lofi', lyrics: '[Verse]\nla la la\n' }, () => 1).style)).not.toContain('no vocals');
  });
});

describe('namesVocals: a request that names the words or the voice', () => {
  it('en / de / es', () => {
    for (const r of ['remove the lyrics', 'ohne Gesang', 'mach es instrumental', 'sin letra', 'doch mit Text bitte', 'no vocals', 'mit Stimme']) expect(namesVocals(r), r).toBe(true);
    for (const r of ['etwas schneller', 'make it faster', 'más lento', 'add a bridge']) expect(namesVocals(r), r).toBe(false);
  });
});
