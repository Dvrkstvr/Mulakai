/**
 * Which model writes a recipe's lyrics, per language (D-235, D-237): env `LYRICS_MODEL_<LANG>` (ISO code
 * upper case), else German's gemma4 (owner: one German model; SP-7 read it as the best German singer),
 * else the planner's own model (no reload). Pure (env passed in).
 */
export const DEFAULT_LYRICS_MODEL: Record<string, string> = { de: 'gemma4:26b-a4b-it-q4_K_M' };

/** The lyrics model for `language`; `plannerModel` is LLM_MODEL. */
export function lyricsModelFor(language: string, env: Record<string, string | undefined> = process.env, plannerModel: string): string {
  const set = env[`LYRICS_MODEL_${language.toUpperCase()}`]?.trim();
  return set || DEFAULT_LYRICS_MODEL[language] || plannerModel;
}
