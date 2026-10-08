import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { CHAT_RULES, ENGINE_ADAPTATION, REFERENCE_RULE, REVISE_ADAPTATION, chatRules } from './chatRules.js';
import { PLANNER_RULES } from '../score/plannerRules.js';

/** SP-5 prompt.py rules_for() with V3 and V31 on (= v3.1, the prompt that passed every bar), written by the spike's own code. */
const V31 = readFileSync(new URL('../../../test-fakes/data/sp5-rules-v31.txt', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

describe('chat rules (the system prompt = a snapshot of SP-5 v3.1 rules_for())', () => {
  it('is the spike\'s v3.1 text, with two adaptations: YuE2 is the only engine (D-112 e); a follow-up edit revises (C2, D-227)', () => {
    expect(V31).toContain(ENGINE_ADAPTATION.spike);
    expect(V31).toContain(REVISE_ADAPTATION.spike);
    expect(CHAT_RULES).toBe(V31.replace(ENGINE_ADAPTATION.spike, ENGINE_ADAPTATION.c0).replace(REVISE_ADAPTATION.spike, REVISE_ADAPTATION.c2));
    expect(CHAT_RULES).not.toContain('send the complete op list');
  });

  it('carries the planner\'s op reference verbatim, not its "answer with {ops}" opening', () => {
    const ref = PLANNER_RULES.slice(PLANNER_RULES.indexOf('Ops (bars are numbered'));
    expect(CHAT_RULES.endsWith(ref)).toBe(true);
    expect(CHAT_RULES).not.toContain('You answer with ONE JSON object {"ops":[...]}');
  });

  it('keeps the v3 fixes: no copyable assumption example, missing section -> say, the HEADER is quoted', () => {
    expect(CHAT_RULES).not.toContain('assuming 4/4 and A minor');
    expect(CHAT_RULES).toContain('do not substitute another place: answer say, tell what the song has instead');
    expect(CHAT_RULES).toContain('exactly as the HEADER shows them NOW');
    expect(CHAT_RULES).toContain('A REWRITE_LYRICS keeps the language of the song\'s own lyrics');
  });

  it('a narrower set drops the other actions, the recipe fields and the op reference (ladder rung 2)', () => {
    const rules = chatRules(['ask', 'recipe', 'say']);
    expect(rules).not.toContain('- edit: ');
    expect(rules).not.toContain('Ops (bars are numbered');
    expect(rules).toContain('RECIPE FIELDS');
    expect(chatRules(['say'])).not.toContain('RECIPE FIELDS');
    expect(chatRules(['say'])).toContain('- say: ');
  });

  it('C3: the REFERENCE rule is added only when a reading is in the state, after the recipe fields (D-128)', () => {
    expect(chatRules(['ask', 'recipe', 'say'], { reference: false })).not.toContain(REFERENCE_RULE);
    const rules = chatRules(['ask', 'recipe', 'say'], { reference: true });
    expect(rules.indexOf(REFERENCE_RULE)).toBeGreaterThan(rules.indexOf('RECIPE FIELDS'));
    expect(REFERENCE_RULE).toContain('reference_use');
    expect(chatRules(['say'], { reference: true })).not.toContain(REFERENCE_RULE);
  });

  it('CP-C3 fix: cover only for this same song; a different song and an unsure request are a borrow', () => {
    expect(REFERENCE_RULE).not.toContain('COVER: possible: cover');
    expect(REFERENCE_RULE).toContain('cover = ONLY when the person asks for THIS SAME song again');
    expect(REFERENCE_RULE).toContain('borrow = a different song in its style');
    expect(REFERENCE_RULE).toContain('Unsure: borrow, and say so in assumptions.');
  });
});
