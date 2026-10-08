/**
 * The lyrics call's checks (D-236), each reason phrased as the retry's instruction: the schema's shape
 * (an Ollama reply may still break it), no bracket tag in a line, no line with a line break inside it or
 * under 6 characters (SP-7 gemma3 DE08), the whole text's language = the recipe's (language-ID injected,
 * lyricLanguage.ts; skipped under 40 characters), and no prompt-only word: a word of 4+ letters from the
 * system rules that the request, title and style do not use (SP-7 gemma4 RC09 sang "Mulakai" in an
 * outro). The rules are English, so their everyday words are left out (a lyric in any of the six
 * languages may sing "story" or "idea"); what is left is the rules' own vocabulary. Pure.
 */
import { LINES, RECIPE_LIMITS } from './recipeRules.js';
import { languageName, lyricsRules, sungTags, type LyricsRequest } from './lyricsPrompt.js';
import type { DetectLanguage } from './replyGuards.js';

/** Language-ID is unreliable under about 40 characters (replyGuards' bound, SP-5). */
const LID_MIN = 40;
const LINE_MIN = 6;
const BRACKET = /[[\]]/;
const WORD = /\p{L}+/gu;
/** Always refused, whatever the request says: the product's name is never a lyric. */
const ALWAYS = ['mulakai'];
/** Words of the rules a lyric may well sing (or that are lyric words in de/es/it: "Tags", "idea", "studio"). */
const EVERYDAY = new Set([
  'answer', 'entry', 'every', 'exactly', 'given', 'idea', 'language', 'line', 'lines', 'listed', 'local', 'matching', 'more', 'move', 'must',
  'natural', 'only', 'order', 'other', 'repeats', 'song', 'stage', 'story', 'studio', 'style', 'sung', 'tags', 'than', 'that', 'title',
  'twice', 'with', 'write',
]);
const q = (s: string) => JSON.stringify(s);
const wordsOf = (text: string): string[] => (text.match(WORD) ?? []).map((w) => w.toLowerCase());

/** Lower-case words that may not appear in this request's lyrics. */
export function promptOnlyWords(ctx: LyricsRequest): Set<string> {
  const own = new Set(wordsOf(`${ctx.request} ${ctx.title} ${ctx.style}`));
  const out = new Set(wordsOf(lyricsRules(ctx.language)).filter((w) => w.length >= 4 && !EVERYDAY.has(w) && !own.has(w)));
  for (const w of ALWAYS) out.add(w);
  return out;
}

type Shape = { ok: true; sections: string[][] } | { ok: false; reasons: string[] };

function shapeOf(json: unknown, n: number): Shape {
  const sections = (json as { sections?: unknown } | null)?.sections;
  if (!Array.isArray(sections)) return { ok: false, reasons: ['answer with {"sections": [{"lines": [...]}, ...]}: one entry per listed section'] };
  if (sections.length !== n) return { ok: false, reasons: [`write exactly ${n} sections, one per listed section, in order; you wrote ${sections.length}`] };
  const reasons: string[] = [];
  const out = sections.map((s, i) => {
    const lines = (s as { lines?: unknown } | null)?.lines;
    if (!Array.isArray(lines)) return reasons.push(`section ${i + 1}: write {"lines": [...]}`), [];
    if (lines.length < LINES.min || lines.length > LINES.max) reasons.push(`section ${i + 1} has ${lines.length} lines: write ${LINES.min} to ${LINES.max}`);
    if (!lines.every((l) => typeof l === 'string' && l.length >= 1 && l.length <= RECIPE_LIMITS.line)) {
      reasons.push(`section ${i + 1}: every line must be text of 1 to ${RECIPE_LIMITS.line} characters`);
    }
    return lines as string[];
  });
  return reasons.length ? { ok: false, reasons } : { ok: true, sections: out };
}

function lineProblems(line: string, at: string, banned: Set<string>): string[] {
  const out: string[] = [];
  if (BRACKET.test(line)) out.push(`${at} has a tag or bracket (${q(line.slice(0, 40))}): write the sung words only, no tags`);
  if (/[\r\n]/.test(line)) out.push(`${at} has a line break inside it: put each sung line in its own entry`);
  else if (line.trim().length < LINE_MIN) out.push(`${at} (${q(line)}) is under ${LINE_MIN} characters: write a whole sung line`);
  const word = (line.match(WORD) ?? []).find((w) => banned.has(w.toLowerCase()));
  if (word) out.push(`${at} contains '${word}', a word from your instructions, not from the song: remove it`);
  return out;
}

/** Why a lyrics reply is not acceptable yet, as the retry tells the model. Empty = ok. */
export async function lyricsProblems(json: unknown, ctx: LyricsRequest, detect: DetectLanguage): Promise<string[]> {
  const shape = shapeOf(json, sungTags(ctx.structure).length);
  if (!shape.ok) return shape.reasons;
  const banned = promptOnlyWords(ctx);
  const out = shape.sections.flatMap((lines, s) => lines.flatMap((l, i) => lineProblems(l, `line ${i + 1} of section ${s + 1}`, banned)));
  const text = shape.sections.flat().join(' ');
  if (text.length >= LID_MIN) {
    const got = await detect(text);
    const name = languageName(ctx.language);
    if (got && got !== ctx.language) out.push(`the lyrics read as '${got}', not ${name} ('${ctx.language}'): write every line in ${name}`);
  }
  return out;
}
