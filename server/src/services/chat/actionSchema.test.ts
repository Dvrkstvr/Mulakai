import { describe, it, expect } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
import { NO_SONG_FACTS, turnSchema } from './actionSchema.js';
import { KEYS, SUNG_TAGS } from './recipeRules.js';
import type { ScoreFacts } from '../score/planTypes.js';

const facts = contract('read-ok').response.body.facts as ScoreFacts;
type Schema = Record<string, any>;
const part = (s: Schema, action: string): Schema => (s.anyOf ?? [s]).find((p: Schema) => p.properties.action.const === action);

describe('turn reply schema (SP-5 turn_schema)', () => {
  it('is anyOf the allowed actions, each a closed object with a const action', () => {
    const s = turnSchema({ facts: null, phraseBars: 4, allowed: ['ask', 'recipe', 'say'] }) as Schema;
    expect(s.anyOf.map((p: Schema) => p.properties.action.const)).toEqual(['ask', 'recipe', 'say']);
    for (const p of s.anyOf) expect(p.additionalProperties).toBe(false);
  });

  it('one allowed action is that action\'s schema alone', () => {
    expect(turnSchema({ facts: null, phraseBars: 4, allowed: ['say'] })).toMatchObject({ properties: { action: { const: 'say' } } });
  });

  it('the recipe takes its enums from recipeRules', () => {
    const recipe = part(turnSchema({ facts: null, phraseBars: 4, allowed: ['recipe'] }), 'recipe').properties.recipe;
    expect(recipe.properties.key.enum).toEqual(KEYS);
    expect(recipe.properties.engine.enum).toEqual(['yue2']);
    expect(recipe.properties.lyrics.items.properties.tag.enum).toEqual(SUNG_TAGS);
    expect(recipe.properties.lyrics.items.properties.lines).toMatchObject({ minItems: 4, maxItems: 8 });
  });

  it('C3: reference_use (cover / borrow / none) is in the recipe only when the thread has a reading (D-128)', () => {
    const recipe = (reference?: boolean) => part(turnSchema({ facts: null, phraseBars: 4, allowed: ['recipe', 'say'], reference }), 'recipe').properties.recipe;
    expect(recipe().properties.reference_use).toBeUndefined();
    expect(recipe(false).required).not.toContain('reference_use');
    expect(recipe(true).properties.reference_use).toEqual({ enum: ['cover', 'borrow', 'none'] });
    expect(recipe(true).required).toContain('reference_use');
  });

  it('CP-C3 fix: reference_use is the first key of the recipe, decided before the model writes lyrics', () => {
    const recipe = part(turnSchema({ facts: null, phraseBars: 4, allowed: ['recipe', 'say'], reference: true }), 'recipe').properties.recipe;
    expect(Object.keys(recipe.properties)[0]).toBe('reference_use');
    expect(recipe.required[0]).toBe('reference_use');
    const plain = part(turnSchema({ facts: null, phraseBars: 4, allowed: ['recipe'] }), 'recipe').properties.recipe;
    expect(Object.keys(plain.properties)[0]).toBe('title');
  });

  it('edit ops are bounded by the song, and by dummy 300-bar bounds without one', () => {
    const bars = (s: Schema) => part(s, 'edit').properties.ops.items.anyOf.find((o: Schema) => o.properties.op.const === 'REHARMONIZE').properties.from_bar.maximum;
    expect(bars(turnSchema({ facts, phraseBars: 4, allowed: ['edit', 'say'] }))).toBe(facts.header.bars);
    expect(bars(turnSchema({ facts: null, phraseBars: 4, allowed: ['edit', 'say'] }))).toBe(NO_SONG_FACTS.header.bars);
  });

  it('has no ABC field anywhere: the model never writes a score (decisions/0002)', () => {
    const text = JSON.stringify(turnSchema({ facts, phraseBars: 4, allowed: ['ask', 'recipe', 'edit', 'scalpel', 'analyze', 'say'] }));
    expect(text).not.toMatch(/"abc"/i);
  });

  it('C1: a mark bounds the edit\'s bars (D-176); no mark keeps the whole song', () => {
    const ops = (barRange?: [number, number]) => part(turnSchema({ facts, phraseBars: 4, allowed: ['edit'], barRange }), 'edit').properties.ops;
    const rh = (o: Schema) => o.items.anyOf.find((p: Schema) => p.properties.op.const === 'REHARMONIZE');
    expect(rh(ops([47, 58])).properties.from_bar).toMatchObject({ minimum: 47, maximum: 58 });
    expect(rh(ops()).properties.from_bar).toMatchObject({ minimum: 1, maximum: 65 });
  });
});
