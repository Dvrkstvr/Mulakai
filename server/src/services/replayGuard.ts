/** Which stored versions ALT (startRegenerate) and SIMILAR (startSimilarTake) can replay on ACE-Step. */

/**
 * An imported song's base version has no generation behind it (its params_json is
 * `{"task_type":"import"}` — see routes/songImport.ts), so ALT/SIMILAR have nothing to
 * replay: they would submit an effectively empty text2music and return audio unrelated
 * to the song. `import` is not an ACE-Step TaskType, hence the plain string compare.
 */
export const NOT_REPLAYABLE = 'imported audio has no generation to replay';

/**
 * An extra engine's base version (params_json carries `engine` — see engineGenJobs.ts)
 * holds a request shaped for another model; rebuilding an ACE-Step request from it would
 * quietly produce an ACE-Step song. Versions ACE-Step later adds to such a song have no
 * `engine` and replay normally.
 */
export const NOT_REPLAYABLE_ENGINE = 'this version was made by another engine; ALT and SIMILAR only replay ACE-Step versions';

/** Every assertReplayable refusal, for routes mapping them to a 400. */
export const NOT_REPLAYABLE_ERRORS: ReadonlySet<string> = new Set([NOT_REPLAYABLE, NOT_REPLAYABLE_ENGINE]);

export function assertReplayable(stored: { task_type?: string; engine?: string }): void {
  if (stored.task_type === 'import') throw new Error(NOT_REPLAYABLE);
  if (stored.engine) throw new Error(NOT_REPLAYABLE_ENGINE);
}
