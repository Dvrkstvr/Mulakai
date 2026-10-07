import { describe, it, expect } from 'vitest';
import { RECIPE, readingFixture } from '../../../test-fakes/chatScripts.js';
import { emptyDraft, handEdit } from './draftModel.js';
import { REDIRECT, dispatchReply } from './turnDispatch.js';
import type { AnalyzeBody, TurnReply } from './chatTypes.js';

const recipe: TurnReply = { action: 'recipe', message: 'Here it is.', assumptions: ['assuming A minor'], recipe: RECIPE };
const base = { hasSong: false, draft: emptyDraft(), sentRev: 0, scoreReason: null };

describe('turn dispatch (a checked reply -> what the turn writes)', () => {
  it('say and ask are messages; ask keeps its choices', () => {
    expect(dispatchReply({ ...base, reply: { action: 'say', message: 'hi' } })).toEqual({ kind: 'say', text: 'hi', body: null });
    expect(dispatchReply({ ...base, reply: { action: 'ask', message: 'Which?', choices: ['a', 'b'] } })).toEqual({ kind: 'ask', text: 'Which?', body: { choices: ['a', 'b'] } });
  });

  it('a recipe on the draft thread merges into the draft and becomes a card with changed fields', () => {
    const out = dispatchReply({ ...base, reply: recipe });
    expect(out.kind).toBe('recipe');
    if (out.kind !== 'recipe') return;
    expect(out.draft.fields).toMatchObject({ title: RECIPE.title, key: 'Am', timeSignature: '4/4' });
    expect(out.body).toMatchObject({ recipe: RECIPE, assumptions: ['assuming A minor'], skipped: [] });
    expect(out.body.changed).toContain('title');
  });

  it('a field touched by hand after SEND is skipped and named (CH-6)', () => {
    const typed = handEdit(emptyDraft(), { title: 'Mine' }).draft; // rev 1, after sentRev 0
    const out = dispatchReply({ ...base, draft: typed, reply: recipe });
    if (out.kind !== 'recipe') throw new Error('not a recipe');
    expect(out.draft.fields.title).toBe('Mine');
    expect(out.body.skipped).toEqual(['title']);
  });

  it('scalpel becomes a say naming where it can be done', () => {
    const scalpel = dispatchReply({ ...base, hasSong: true, reply: { action: 'scalpel', message: 'x', kind: 'add_layer', target: 'whole song', details: 'sax' } });
    expect(scalpel).toEqual({ kind: 'say', text: REDIRECT.scalpel('add_layer'), body: null });
    expect(REDIRECT.scalpel('add_layer')).toContain('ADD LAYER');
  });

  it('C0a: an edit points to SCORE in the Editor, a recipe on a song thread to NEW CHAT (D-110)', () => {
    const edit: TurnReply = { action: 'edit', message: 'x', assumptions: [], ops: [] };
    expect(dispatchReply({ ...base, hasSong: true, reply: edit }).text).toContain('SCORE');
    expect(dispatchReply({ ...base, hasSong: true, scoreReason: 'yue-server did not answer', reply: edit }).text).toContain('yue-server did not answer');
    expect(dispatchReply({ ...base, reply: edit }).text).toBe(REDIRECT.noSong);
    expect(dispatchReply({ ...base, hasSong: true, reply: recipe })).toEqual({ kind: 'say', text: REDIRECT.recipeOnSong, body: null });
  });

  const analyze: TurnReply = { action: 'analyze', message: 'I will read it first.', reference: 'demo.mp3', plan: 'a cover' };
  const card: AnalyzeBody = { target: { referenceId: 'r1' }, name: 'demo.mp3', seconds: 200, readTo: 200, cut: false, estimate: { words: 16, score: 35, caption: 16, total: 67 } };

  it('C3: analyze on the draft thread resolved -> a READ card with its body (F-061)', () => {
    expect(dispatchReply({ ...base, reply: analyze, analyze: { body: card } })).toEqual({ kind: 'analyze', text: 'I will read it first.', body: card });
  });

  it('C3: analyze not resolved -> a say naming what is attached and the ATTACH control', () => {
    const out = dispatchReply({ ...base, reply: analyze, analyze: { reason: 'nothing called "x" is attached or in the library', attached: ['demo.mp3'] } });
    expect(out.kind).toBe('say');
    expect(out.text).toContain('nothing called "x" is attached or in the library');
    expect(out.text).toContain('Attached here: "demo.mp3"');
    expect(out.text).toContain('ATTACH');
    expect(dispatchReply({ ...base, reply: analyze }).text).toContain('ATTACH');
  });

  it('C3: analyze on a song thread points to NEW CHAT (D-130)', () => {
    expect(dispatchReply({ ...base, hasSong: true, reply: analyze, analyze: { body: card } })).toEqual({ kind: 'say', text: REDIRECT.analyzeOnSong, body: null });
  });

  it('C3: a recipe with reference_use on a reading: code fills the borrowed fields and the card names them (D-128; the score first, C3 live D)', () => {
    const reply: TurnReply = { ...recipe, recipe: { ...RECIPE, bpm: 140, key: 'E', reference_use: 'borrow' } };
    const out = dispatchReply({ ...base, reply, reference: { id: 'r1', reading: readingFixture() } });
    if (out.kind !== 'recipe') throw new Error('not a recipe');
    expect(out.draft.fields).toMatchObject({ bpm: 96, key: 'Am' });
    expect(out.body.recipe).toMatchObject({ bpm: 96, key: 'Am', reference_use: 'borrow' });
    expect(out.body.reference).toMatchObject({ referenceId: 'r1', use: 'borrow', borrowed: ['bpm', 'key', 'timeSignature', 'structure'] });
    expect(out.draft.reference).toEqual({ referenceId: 'r1', use: 'borrow' });
  });

  it('C3: reference_use none, or no reading: the recipe as the model wrote it, no reference on the card', () => {
    const none: TurnReply = { ...recipe, recipe: { ...RECIPE, reference_use: 'none' } };
    const out = dispatchReply({ ...base, reply: none, reference: { id: 'r1', reading: readingFixture() } });
    if (out.kind !== 'recipe') throw new Error('not a recipe');
    expect(out.body).not.toHaveProperty('reference');
    expect(out.draft.fields.bpm).toBe(RECIPE.bpm);
  });
});
