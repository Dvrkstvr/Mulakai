import { describe, it, expect } from 'vitest';
import { ACTIONS, allowedActions, redirected } from './turnActions.js';

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

  it('C0a answers scalpel, analyze and edit as a say everywhere, and a recipe on a song thread (D-098, D-110)', () => {
    expect(redirected({ hasSong: false, scoreReadable: false })).toEqual(['scalpel', 'analyze', 'edit']);
    expect(redirected({ hasSong: true, scoreReadable: true })).toEqual(['scalpel', 'analyze', 'edit', 'recipe']);
    expect(redirected({ hasSong: true, scoreReadable: true }, true)).toEqual(['scalpel', 'analyze', 'recipe']);
  });
});
