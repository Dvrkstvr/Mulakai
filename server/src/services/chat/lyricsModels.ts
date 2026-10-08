/**
 * Which model writes a recipe's lyrics, per language (D-235): env `LYRICS_MODELS_<LANG>` (ISO code upper
 * case, comma list), else German's gemma4 (owner, 2026-10-08: one German model, no two drafts; SP-7 read
 * it as the best German singer), else the planner's own model (no reload). The env may still name two
 * models; more are ignored. Pure (env passed in).
 */
export const MAX_LYRICS_MODELS = 2;
export const DEFAULT_LYRICS_MODELS: Record<string, string[]> = { de: ['gemma4:26b-a4b-it-q4_K_M'] };

/** 1..2 model names for `language`; `plannerModel` is LLM_MODEL. */
export function lyricsModelsFor(language: string, env: Record<string, string | undefined> = process.env, plannerModel: string): string[] {
  const listed = (env[`LYRICS_MODELS_${language.toUpperCase()}`] ?? '').split(',').map((m) => m.trim()).filter(Boolean);
  const models = listed.length ? listed : DEFAULT_LYRICS_MODELS[language] ?? [plannerModel];
  return models.slice(0, MAX_LYRICS_MODELS);
}
