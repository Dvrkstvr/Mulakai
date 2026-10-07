import { describe, it, expect } from 'vitest';
import { ACTIONS, EDITS_ON, allowedActions, redirected } from './turnActions.js';

describe('turn actions', () => {
  it('rung 0 and 1 offer SP-5\'s whole set whatever the state', () => {
    expect(allowedActions({ hasSong: false, scoreReadable: false })).toEqual(ACTIONS);
    expect(allowedActions({ hasSong: true, scoreReadable: true }, 1)).toEqual(ACTIONS);
  });

  it('rung 2 offers only what the state allows', () => {
    expect(allowedActions({ hasSong: false, scoreReadable: false }, 2)).toEqual(['ask', 'recipe', 'analyze', 'say']);
    expect(allowedActions({ hasSong: true, scoreReadable: false }, 2)).toEqual(['ask', 'recipe', 'scalpel', 'analyze', 'say']);
    expect(allowedActions({ hasSong: true, scoreReadable: true }, 2)).toEqual(ACTIONS);
  });

  it('a follow-up turn after a reading allows ask, recipe and say only, at every rung (D-129)', () => {
    expect(allowedActions({ hasSong: false, scoreReadable: false, followUp: true })).toEqual(['ask', 'recipe', 'say']);
    expect(allowedActions({ hasSong: false, scoreReadable: false, followUp: true }, 2)).toEqual(['ask', 'recipe', 'say']);
  });

  it('CP-C3 fix: a file attached on the draft thread and not read yet allows only analyze, ask and say, at every rung', () => {
    const s = { hasSong: false, scoreReadable: false, attached: true };
    expect(allowedActions(s)).toEqual(['ask', 'analyze', 'say']);
    expect(allowedActions(s, 2)).toEqual(['ask', 'analyze', 'say']);
    expect(allowedActions({ ...s, referenceRead: true })).toEqual(ACTIONS);
    expect(allowedActions({ ...s, followUp: true, referenceRead: true })).toEqual(['ask', 'recipe', 'say']);
    expect(allowedActions({ hasSong: true, scoreReadable: true, attached: true })).toEqual(ACTIONS);
  });

  it('D-194: a mark with no bars (a time only, bars not read) offers no edit, at every rung; the turn answers in words', () => {
    const s = { hasSong: true, scoreReadable: true, timeMark: true };
    expect(allowedActions(s)).toEqual(['ask', 'recipe', 'scalpel', 'analyze', 'say']);
    expect(allowedActions(s, 2)).toEqual(['ask', 'recipe', 'scalpel', 'analyze', 'say']);
    expect(allowedActions({ ...s, timeMark: false })).toEqual(ACTIONS);
  });

  it('C3 answers analyze on the draft thread; scalpel stays a say everywhere, edit without a song or with edits off, analyze and a recipe on a song thread (D-098, D-110, D-130)', () => {
    expect(redirected({ hasSong: false, scoreReadable: false })).toEqual(['scalpel', 'edit']);
    expect(redirected({ hasSong: true, scoreReadable: true }, false)).toEqual(['scalpel', 'analyze', 'edit', 'recipe']);
  });

  it('CB-2: an edit on a song with a readable score is a real plan; without a readable score it is a say with the reason (F-046 edge)', () => {
    expect(EDITS_ON).toBe(true);
    expect(redirected({ hasSong: true, scoreReadable: true })).toEqual(['scalpel', 'analyze', 'recipe']);
    expect(redirected({ hasSong: true, scoreReadable: false })).toEqual(['scalpel', 'analyze', 'edit', 'recipe']);
  });
});
