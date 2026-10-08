/**
 * The lyrics call's prompt and schema (SP-5 ladder.py rung 3, `lyrics_rules` / `lyrics_call` / `lyrics_schema`,
 * kept unchanged per SP-7: it worked on all four models): system rules naming the language, a user message
 * with the request, the recipe's title, style, tempo and the sung sections in order, and a strict
 * `{sections: [{lines}]}` with exactly one entry per sung section. The sections' tags come from the
 * structure, never from the model. Bounds come from recipeRules. Pure.
 */
import type { ChatMessage } from '../score/planTypes.js';
import { LINES, RECIPE_LIMITS, SUNG_TAGS } from './recipeRules.js';

/** What the lyrics call is given: the person's words and the passed recipe's fields. */
export interface LyricsRequest {
  request: string;
  title: string;
  style: string;
  bpm: number;
  language: string;
  structure: string[];
}

/** recipeRules' LANGUAGES in words (SP-5 LANG_NAME). */
export const LANGUAGE_NAME: Record<string, string> = { en: 'English', de: 'German', es: 'Spanish', fr: 'French', it: 'Italian', pt: 'Portuguese' };
export const languageName = (code: string): string => LANGUAGE_NAME[code] ?? code;

/** The sections that get lines: the structure minus instrumental ones, in order. */
export function sungTags(structure: string[]): string[] {
  return structure.filter((t) => SUNG_TAGS.includes(t));
}

export function lyricsRules(language: string): string {
  const name = languageName(language);
  return `You write song lyrics for Mulakai, a local song studio. Write ONLY in ${name}: every line must be natural, singable ${name}, no other language, `
    + `no translations, no stage directions, no brackets or tags. You are given the song's title, style and the sung sections in order; write ${LINES.min} to `
    + `${LINES.max} lines per section, matching the title and style, a chorus that repeats its idea (not a line more than twice), verses that move the story on. `
    + 'Answer with {"sections": [{"lines": [...]}, ...]}: exactly one entry per listed section, in order.';
}

export function lyricsMessages(input: LyricsRequest): ChatMessage[] {
  const user = [
    `REQUEST (the person's own words): ${input.request}`, `TITLE: ${input.title}`, `STYLE: ${input.style}`, `TEMPO: ${input.bpm} bpm`,
    `LANGUAGE: ${languageName(input.language)}`, 'SUNG SECTIONS IN ORDER:', ...sungTags(input.structure).map((t, i) => `${i + 1}. ${t}`),
  ].join('\n');
  return [{ role: 'system', content: lyricsRules(input.language) }, { role: 'user', content: user }];
}

type Schema = Record<string, unknown>;
const obj = (properties: Record<string, Schema>): Schema => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });

/** Exactly `n` sections, each LINES.min..max lines of 1..RECIPE_LIMITS.line characters. */
export function lyricsSchema(n: number): Schema {
  const lines = { type: 'array', minItems: LINES.min, maxItems: LINES.max, items: { type: 'string', minLength: 1, maxLength: RECIPE_LIMITS.line } };
  return obj({ sections: { type: 'array', minItems: n, maxItems: n, items: obj({ lines }) } });
}
