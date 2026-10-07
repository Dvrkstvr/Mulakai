/** Code fills the borrowed fields from the reading, never the model (D-128, F-063, F-064). */
import { describe, it, expect } from 'vitest';
import { RECIPE, readingFixture } from '../../../test-fakes/chatScripts.js';
import { coverBlockers, referenceRecipe, sectionTag } from './referenceRecipe.js';
import type { Draft, Recipe } from './chatTypes.js';
import type { Reading } from './reading.js';

const model = (use: Recipe['reference_use'], over: Partial<Recipe> = {}): Recipe => ({ ...RECIPE, bpm: 140, key: 'E', reference_use: use, ...over });
const noCaption = (r: Reading): Reading => ({ ...r, caption: { notRead: 'ACE-Step is not running' } });

describe('sectionTag (a score label -> the closed tag list)', () => {
  it('maps known labels in any case and numbering, anything else is a Verse', () => {
    expect(['intro', 'Verse 2', 'CHORUS', 'pre-chorus', 'Prechorus', 'bridge', 'outro', 'solo', ''].map(sectionTag))
      .toEqual(['Intro', 'Verse', 'Chorus', 'Pre-Chorus', 'Pre-Chorus', 'Bridge', 'Outro', 'Verse', 'Verse']);
  });
});

describe('referenceRecipe', () => {
  it('none, or no reference_use: the recipe as the model wrote it, no reference', () => {
    expect(referenceRecipe(model('none'), readingFixture(), 'r1')).toEqual({ recipe: model('none'), reference: null });
    expect(referenceRecipe(RECIPE, readingFixture(), 'r1').reference).toBeNull();
  });

  it('borrow: tempo, key, meter (the score first, C3 live D) and structure from the reading, marked; the model keeps title, style, words', () => {
    const { recipe, reference } = referenceRecipe(model('borrow'), readingFixture(), 'r1');
    expect(recipe).toMatchObject({ bpm: 96, key: 'Am', time_signature: '4/4', title: RECIPE.title, style: RECIPE.style });
    expect(recipe.structure).toEqual(['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus']);
    expect(recipe.lyrics.map((s) => s.tag)).toEqual(['Verse', 'Chorus', 'Verse', 'Chorus']);
    expect(recipe.lyrics[2].lines).toEqual(RECIPE.lyrics[2].lines); // the second verse is the model's second verse
    expect(reference).toEqual({ referenceId: 'r1', use: 'borrow', borrowed: ['bpm', 'key', 'timeSignature', 'structure'], missing: [], note: null });
  });

  it("trap (F-064 edge): a key the reading lacks is left blank and named; the model's key never survives", () => {
    const r = readingFixture({ caption: { caption: 'x', bpm: 120, key: null, meter: null } });
    const score = r.score as Exclude<Reading['score'], { notRead: string }>;
    const noKey = { ...r, score: { ...score, facts: { ...score.facts!, header: { ...score.facts!.header, key: 'D dorian' } } } };
    const { recipe, reference } = referenceRecipe(model('borrow'), noKey, 'r1');
    expect('key' in recipe).toBe(false);
    expect(reference).toMatchObject({ borrowed: ['bpm', 'timeSignature', 'structure'], missing: ['key'] });
  });

  it('borrow with no score read: the caption gives tempo, key and meter (code still fills them, F-064)', () => {
    const { recipe } = referenceRecipe(model('borrow'), readingFixture({ score: { notRead: 'yue-server is not running' } }), 'r1');
    expect(recipe).toMatchObject({ bpm: 120, key: 'Dm', time_signature: '4/4' });
  });

  it('no sections read: the structure stays the model\'s and the note says so', () => {
    const r = readingFixture({ score: { notRead: 'yue-server is not running' } });
    const { recipe, reference } = referenceRecipe(model('borrow'), r, 'r1');
    expect(recipe.structure).toEqual(RECIPE.structure);
    expect(reference).toMatchObject({ borrowed: ['bpm', 'key', 'timeSignature'], missing: [], note: expect.stringContaining('no sections') });
  });

  it('cover: tempo, key and meter are the score\'s own (not the caption\'s), one lyrics entry per sung score section', () => {
    const { recipe, reference } = referenceRecipe(model('cover', { lyrics: [RECIPE.lyrics[0], RECIPE.lyrics[1]] }), readingFixture(), 'r1');
    expect(recipe).toMatchObject({ bpm: 96, key: 'Am', time_signature: '4/4', structure: ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus'] });
    expect(recipe.lyrics.map((s) => s.tag)).toEqual(['Verse', 'Chorus', 'Verse', 'Chorus']);
    expect(recipe.lyrics[2]).toEqual(RECIPE.lyrics[0]); // a section the model wrote once is sung again
    expect(reference).toEqual({ referenceId: 'r1', use: 'cover', borrowed: ['bpm', 'key', 'timeSignature', 'structure'], missing: [], note: null });
  });

  it('a score label with no model section of its tag takes the model\'s section at that place, retagged', () => {
    const r = readingFixture();
    const score = r.score as Exclude<Reading['score'], { notRead: string }>;
    const sections = [{ index: 1, label: 'verse', from_bar: 1, to_bar: 8 }, { index: 2, label: 'bridge', from_bar: 9, to_bar: 16 }];
    const odd = { ...r, score: { ...score, facts: { ...score.facts!, sections } } };
    const { recipe } = referenceRecipe(model('cover'), odd, 'r1');
    expect(recipe.lyrics).toEqual([RECIPE.lyrics[0], { tag: 'Bridge', lines: RECIPE.lyrics[1].lines }]);
  });

  it('trap (F-063 edge): a cover of a reading that cannot be covered becomes a borrow with the reason', () => {
    const r = noCaption(readingFixture({ score: { notRead: 'yue-server is not running' } }));
    const { reference } = referenceRecipe(model('cover'), r, 'r1');
    expect(reference).toMatchObject({ use: 'borrow', note: expect.stringContaining('a cover is not possible: the score was not read: yue-server is not running') });
    expect(reference?.missing).toEqual(['bpm', 'key', 'timeSignature']);
  });
});

describe('coverBlockers (CREATE COVER, F-063)', () => {
  const cover: Draft = { draft_v: 1, rev: 1, fields: {}, touched: {}, reference: { referenceId: 'r1', use: 'cover' } };
  it('none for a coverable reading of the draft\'s reference', () => {
    expect(coverBlockers(cover, { id: 'r1', reading: readingFixture() })).toEqual([]);
  });
  it('the reference gone, not read or not coverable: the reason', () => {
    expect(coverBlockers(cover, null)).toEqual(['the reference of this cover is gone: attach it again']);
    expect(coverBlockers(cover, { id: 'r1', reading: null })).toEqual(['the reference has not been read: press READ first']);
    expect(coverBlockers(cover, { id: 'r1', reading: readingFixture({ score: { notRead: 'x' } }) })[0]).toContain('a cover is not possible');
  });
  it('a draft that is not a cover has no cover blockers', () => {
    expect(coverBlockers({ ...cover, reference: undefined }, null)).toEqual([]);
  });
});
