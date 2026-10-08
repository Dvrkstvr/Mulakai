/**
 * Which model writes a recipe's lyrics, per language (D-235): env `LYRICS_MODELS_<LANG>` (ISO code upper
 * case, comma list, order = DRAFT A, B), else German's two drafts (owner, D-232: gemma3 and gemma4 each 4/6
 * usable on different requests, together 6/6), else the planner's own model (no reload). Two entries are two
 * drafts; more are ignored. Pure (env passed in).
 */
export const MAX_DRAFTS = 2;
export const DEFAULT_LYRICS_MODELS: Record<string, string[]> = { de: ['gemma3:12b', 'gemma4:26b-a4b-it-q4_K_M'] };

export type DraftLabel = 'A' | 'B';
const LABELS: DraftLabel[] = ['A', 'B'];

/** 1..2 model names for `language`; `plannerModel` is LLM_MODEL. */
export function lyricsModelsFor(language: string, env: Record<string, string | undefined> = process.env, plannerModel: string): string[] {
  const listed = (env[`LYRICS_MODELS_${language.toUpperCase()}`] ?? '').split(',').map((m) => m.trim()).filter(Boolean);
  const models = listed.length ? listed : DEFAULT_LYRICS_MODELS[language] ?? [plannerModel];
  return models.slice(0, MAX_DRAFTS);
}

/** The card's name for draft i: DRAFT A, DRAFT B. */
export function draftLabel(i: number): DraftLabel {
  const label = LABELS[i];
  if (!label) throw new RangeError(`there is no draft ${i}: at most ${MAX_DRAFTS} drafts`);
  return label;
}
