import { describe, it, expect, vi } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
import { RECIPE } from '../../../test-fakes/chatScripts.js';
import { checkReply, type CheckContext } from './replyCheck.js';
import { ACTIONS } from './turnActions.js';
import type { ApplyResult, ScoreFacts } from '../score/planTypes.js';

const facts = contract('read-ok').response.body.facts as ScoreFacts;
const draft: CheckContext = { allowed: ACTIONS, shapeOnly: ['scalpel', 'analyze', 'edit'], facts: null, phraseBars: 4 };
const song: CheckContext = { allowed: ACTIONS, shapeOnly: ['scalpel', 'analyze'], facts, phraseBars: 4 };
const recipe = (over: Record<string, unknown> = {}) => ({ action: 'recipe', message: 'ok', assumptions: [], recipe: { ...RECIPE, ...over } });
const reasons = async (json: unknown, ctx = draft, deps = {}) => {
  const r = await checkReply(json, ctx, deps);
  return r.ok ? [] : r.reasons;
};

describe('reply check', () => {
  it('passes a valid recipe and keeps only the known fields', async () => {
    const r = await checkReply({ ...recipe(), extra: 1 }, draft, {});
    expect(r).toEqual({ ok: true, reply: { action: 'recipe', message: 'ok', assumptions: [], recipe: RECIPE }, applied: null });
  });

  it('refuses an action outside the set, or outside what this turn allows', async () => {
    expect(await reasons({ action: 'dance', message: 'x' })).toEqual(['action "dance" is not one of ask, recipe, edit, scalpel, analyze, say']);
    expect(await reasons({ action: 'edit', message: 'x', assumptions: [], ops: [] }, { ...draft, allowed: ['ask', 'say'] }))
      .toEqual(['action "edit" is not one of ask, say']);
    expect(await reasons('hello')).toEqual(['the reply is not a JSON object {"action": ...}']);
  });

  it('holds a recipe to recipeRules (a bad key is a retry reason)', async () => {
    expect(await reasons(recipe({ key: 'Aminor' }))).toEqual(['key "Aminor" is not one of the 30 key names (C, Am, F#m ...)']);
    expect(await reasons(recipe({ lyrics: [{ tag: 'Verse', lines: ['[Chorus] la'] }] }))).toContain('section 1 (Verse) has 1 lines; write 4-8');
  });

  it('checks shape only for an action this version answers as a say', async () => {
    expect(await reasons({ action: 'edit', message: 'x', assumptions: [], ops: [{ op: 'REHARMONIZE', from_bar: 999 }] })).toEqual([]);
    expect(await reasons({ action: 'scalpel', message: 'x', kind: 'paint', target: 'a', details: '' })).toEqual(['scalpel kind "paint" is not one of repaint, add_layer, split, export']);
    expect(await reasons({ action: 'ask', message: 'x', choices: ['a'] })).toEqual(['ask needs 2-4 choices']);
  });

  it('an edit on a song: bar 999 is refused by the reused checkOps', async () => {
    const out = await reasons({ action: 'edit', message: 'x', assumptions: [], ops: [{ op: 'REHARMONIZE', from_bar: 999, to_bar: 999, chords: [{ bar: 999, beat: 1, root: 'G', quality: 'm7' }] }] }, song);
    expect(out[0]).toBe('op 1 (REHARMONIZE): from_bar 999 is outside the score (bars 1-65)');
  });

  it('an edit on a song is applied and held to the limits: a 458 s plan comes back with the reason', async () => {
    const applied = { ...contract('apply-set-tempo').response.body, seconds: 458 } as unknown as ApplyResult;
    const apply = vi.fn(async () => applied);
    const out = await reasons({ action: 'edit', message: 'x', assumptions: [], ops: [{ op: 'SET_TEMPO', bpm: 50 }] }, song, { apply });
    expect(apply).toHaveBeenCalledOnce();
    expect(out.join(' ')).toMatch(/458/);
  });
});
