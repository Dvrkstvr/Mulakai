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

  it('edit ops are bounded by the song, and by dummy 300-bar bounds without one', () => {
    const bars = (s: Schema) => part(s, 'edit').properties.ops.items.anyOf.find((o: Schema) => o.properties.op.const === 'REHARMONIZE').properties.from_bar.maximum;
    expect(bars(turnSchema({ facts, phraseBars: 4, allowed: ['edit', 'say'] }))).toBe(facts.header.bars);
    expect(bars(turnSchema({ facts: null, phraseBars: 4, allowed: ['edit', 'say'] }))).toBe(NO_SONG_FACTS.header.bars);
  });

  it('has no ABC field anywhere: the model never writes a score (decisions/0002)', () => {
    const text = JSON.stringify(turnSchema({ facts, phraseBars: 4, allowed: ['ask', 'recipe', 'edit', 'scalpel', 'analyze', 'say'] }));
    expect(text).not.toMatch(/"abc"/i);
  });
});
