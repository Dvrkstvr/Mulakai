import { describe, it, expect } from 'vitest';
import { RECIPE } from '../../../test-fakes/chatScripts.js';
import { emptyDraft, handEdit } from './draftModel.js';
import { REDIRECT, dispatchReply } from './turnDispatch.js';
import type { TurnReply } from './chatTypes.js';

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

  it('scalpel and analyze become a say naming where it can be done', () => {
    const scalpel = dispatchReply({ ...base, hasSong: true, reply: { action: 'scalpel', message: 'x', kind: 'add_layer', target: 'whole song', details: 'sax' } });
    expect(scalpel).toEqual({ kind: 'say', text: REDIRECT.scalpel('add_layer'), body: null });
    expect(REDIRECT.scalpel('add_layer')).toContain('ADD LAYER');
    expect(dispatchReply({ ...base, reply: { action: 'analyze', message: 'x', reference: 'a', plan: 'b' } })).toMatchObject({ kind: 'say', text: REDIRECT.analyze });
  });

  it('C0a: an edit points to SCORE in the Editor, a recipe on a song thread to NEW CHAT (D-110)', () => {
    const edit: TurnReply = { action: 'edit', message: 'x', assumptions: [], ops: [] };
    expect(dispatchReply({ ...base, hasSong: true, reply: edit }).text).toContain('SCORE');
    expect(dispatchReply({ ...base, hasSong: true, scoreReason: 'yue-server did not answer', reply: edit }).text).toContain('yue-server did not answer');
    expect(dispatchReply({ ...base, reply: edit }).text).toBe(REDIRECT.noSong);
    expect(dispatchReply({ ...base, hasSong: true, reply: recipe })).toEqual({ kind: 'say', text: REDIRECT.recipeOnSong, body: null });
  });
});
