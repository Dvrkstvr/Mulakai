import { describe, it, expect } from 'vitest';
import { CHAT_RULES, chatRules } from './chatRules.js';
import { PLANNER_RULES } from '../score/plannerRules.js';
import { BPM, KEYS, LINES } from './recipeRules.js';

describe('chat rules (the system prompt, SP-5 CHAT_RULES)', () => {
  it('names every action of the closed set and asks for one JSON object in the person\'s language', () => {
    for (const a of ['recipe', 'edit', 'scalpel', 'analyze', 'say', 'ask']) expect(CHAT_RULES).toContain(`- ${a}: `);
    expect(CHAT_RULES).toContain('ONE JSON object {"action": ...}');
    expect(CHAT_RULES).toMatch(/in the person's language/);
  });

  it('carries the planner\'s op reference verbatim, not its "answer with {ops}" opening', () => {
    const ref = PLANNER_RULES.slice(PLANNER_RULES.indexOf('Ops (bars are numbered'));
    expect(CHAT_RULES).toContain(ref);
    expect(CHAT_RULES).not.toContain('You answer with ONE JSON object {"ops":[...]}');
  });

  it('states the recipe rules from recipeRules (bpm range, 4-8 lines, YuE2 only) and the language in the style (D-112)', () => {
    expect(CHAT_RULES).toContain(`bpm ${BPM.min}-${BPM.max}`);
    expect(CHAT_RULES).toContain(`${LINES.min} to ${LINES.max} lines`);
    expect(CHAT_RULES).toContain('engine: "yue2"');
    expect(CHAT_RULES).toMatch(/style: .*starts with the language the words are sung in, in English/);
    expect(CHAT_RULES).toContain(KEYS.join(' '));
  });

  it('a narrower set drops the other actions, the recipe fields and the op reference (ladder rung 2)', () => {
    const rules = chatRules(['ask', 'recipe', 'say']);
    expect(rules).not.toContain('- edit: ');
    expect(rules).not.toContain('Ops (bars are numbered');
    expect(rules).toContain('RECIPE FIELDS');
    expect(chatRules(['say'])).not.toContain('RECIPE FIELDS');
  });
});
