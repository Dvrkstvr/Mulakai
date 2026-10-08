/**
 * A passed recipe's lines (LD, F-095, D-234, D-252; SP-5 rung 3). Code decides keep vs write, not the planner (live,
 * qwen3:14b answered "write" to a tempo tweak 3 of 3): keep takes the draft's lyrics, no call, when they still fit the
 * recipe's structure (recipeRules.lyricsFit), the recipe's language is the draft's and the request is not about the
 * words (asksForLyrics); otherwise the lyrics call writes them (lyricsAttempts), each attempt held to the whole
 * recipe's check too (recipeRules: structure order, LYRICS_MAX). Which model asks is the caller's (turnCall binds it).
 * Pure (I/O injected).
 */
import { lyricsFit, recipeProblems } from './recipeRules.js';
import { asksForLyrics } from './asksForLyrics.js';
import { writeLyrics, type LyricsDeps } from './lyricsAttempts.js';
import type { DraftFields, LyricsMode, Recipe } from './chatTypes.js';

export type LyricsStep =
  | { ok: true; recipe: Recipe; mode: LyricsMode; attempts: number }
  | { ok: false; reasons: string[]; attempts: number };

export interface LyricsInput { request: string; draft: DraftFields | null }

/** Keep only with draft lyrics that fit the new structure, in the recipe's language, for a request not about the words. */
export function lyricsMode(recipe: Pick<Recipe, 'structure' | 'language'>, { request, draft }: LyricsInput): LyricsMode {
  const keep = lyricsFit(recipe.structure, draft?.lyrics) && draft?.language === recipe.language && !asksForLyrics(request);
  return keep ? 'keep' : 'write';
}

export async function recipeLyrics(recipe: Recipe, input: LyricsInput, deps: Omit<LyricsDeps, 'more'>): Promise<LyricsStep> {
  if (lyricsMode(recipe, input) === 'keep') {
    const lyrics = input.draft!.lyrics!.map((s) => ({ tag: s.tag, lines: [...s.lines] }));
    return { ok: true, recipe: { ...recipe, lyrics }, mode: 'keep', attempts: 0 };
  }
  const { title, style, bpm, language, structure } = recipe;
  const out = await writeLyrics({ request: input.request, title, style, bpm, language, structure },
    { ...deps, more: (lyrics) => recipeProblems({ ...recipe, lyrics }) });
  return out.ok ? { ok: true, recipe: { ...recipe, lyrics: out.lyrics }, mode: 'write', attempts: out.attempts } : out;
}
