import { describe, it, expect } from 'vitest';
import { lyricsMessages, lyricsRules, lyricsSchema, sungTags } from './lyricsPrompt.js';
import { LINES, RECIPE_LIMITS } from './recipeRules.js';

const INPUT = {
  request: 'ein ruhiges Lied über den Herbst', title: 'Herbstlicht', style: 'acoustic folk, warm female vocal',
  bpm: 84, language: 'de', structure: ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Outro'],
};

describe('sungTags', () => {
  it('is the structure minus instrumental sections, in order', () => {
    expect(sungTags(INPUT.structure)).toEqual(['Verse', 'Chorus', 'Verse', 'Chorus', 'Outro']);
  });

  it('drops tags that are not sung tags at all', () => {
    expect(sungTags(['Intro', 'Solo', 'Bridge'])).toEqual(['Bridge']);
  });
});

describe('lyricsRules (SP-5 rung 3)', () => {
  it('names the language in words and the line bounds', () => {
    const rules = lyricsRules('de');
    expect(rules).toContain('Write ONLY in German');
    expect(rules).toContain(`write ${LINES.min} to ${LINES.max} lines per section`);
    expect(rules).toContain('exactly one entry per listed section, in order');
  });

  it('falls back to the code for a language without a name', () => {
    expect(lyricsRules('xx')).toContain('Write ONLY in xx');
  });
});

describe('lyricsMessages', () => {
  it('is the rules as system and the song as user, sung sections numbered', () => {
    const [system, user] = lyricsMessages(INPUT);
    expect(system).toEqual({ role: 'system', content: lyricsRules('de') });
    expect(user.role).toBe('user');
    expect(user.content).toBe([
      "REQUEST (the person's own words): ein ruhiges Lied über den Herbst",
      'TITLE: Herbstlicht', 'STYLE: acoustic folk, warm female vocal', 'TEMPO: 84 bpm', 'LANGUAGE: German',
      'SUNG SECTIONS IN ORDER:', '1. Verse', '2. Chorus', '3. Verse', '4. Chorus', '5. Outro',
    ].join('\n'));
  });
});

describe('lyricsSchema', () => {
  it('takes exactly n sections of LINES lines each, line length from RECIPE_LIMITS', () => {
    const s = lyricsSchema(3) as any;
    expect(s.required).toEqual(['sections']);
    expect(s.additionalProperties).toBe(false);
    expect(s.properties.sections).toMatchObject({ type: 'array', minItems: 3, maxItems: 3 });
    const lines = s.properties.sections.items.properties.lines;
    expect(lines).toMatchObject({ minItems: LINES.min, maxItems: LINES.max });
    expect(lines.items).toEqual({ type: 'string', minLength: 1, maxLength: RECIPE_LIMITS.line });
  });
});
