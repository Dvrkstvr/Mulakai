/**
 * A passed recipe's lines (LD, F-095, D-234; SP-5 rung 3): `keep` takes the draft's lyrics, no call, while
 * they still fit the recipe's structure (recipeRules.lyricsFit); otherwise, whatever the planner said, the
 * lyrics call writes them (lyricsAttempts), each attempt held to the whole recipe's check too (recipeRules:
 * structure order, LYRICS_MAX). Which model asks is the caller's (turnCall binds it). Pure (I/O injected).
 */
import { lyricsFit, recipeProblems } from './recipeRules.js';
import { writeLyrics, type LyricsDeps } from './lyricsAttempts.js';
import type { DraftFields, LyricsMode, Recipe } from './chatTypes.js';

export type LyricsStep =
  | { ok: true; recipe: Recipe; mode: LyricsMode; attempts: number }
  | { ok: false; reasons: string[]; attempts: number };

/** What the planner asked for, made safe: `keep` only with lyrics that fit the new structure. */
export function lyricsMode(asked: LyricsMode, recipe: Pick<Recipe, 'structure'>, draft: DraftFields | null): LyricsMode {
  return asked === 'keep' && lyricsFit(recipe.structure, draft?.lyrics) ? 'keep' : 'write';
}

export async function recipeLyrics(recipe: Recipe, asked: LyricsMode, input: { request: string; draft: DraftFields | null },
  deps: Omit<LyricsDeps, 'more'>): Promise<LyricsStep> {
  if (lyricsMode(asked, recipe, input.draft) === 'keep') {
    const lyrics = input.draft!.lyrics!.map((s) => ({ tag: s.tag, lines: [...s.lines] }));
    return { ok: true, recipe: { ...recipe, lyrics }, mode: 'keep', attempts: 0 };
  }
  const { title, style, bpm, language, structure } = recipe;
  const out = await writeLyrics({ request: input.request, title, style, bpm, language, structure },
    { ...deps, more: (lyrics) => recipeProblems({ ...recipe, lyrics }) });
  return out.ok ? { ok: true, recipe: { ...recipe, lyrics: out.lyrics }, mode: 'write', attempts: out.attempts } : out;
}
