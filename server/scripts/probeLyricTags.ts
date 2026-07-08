/**
 * CLI wrapper for the same probe the Settings UI's "PROBE FOR NEW TAGS" button triggers —
 * see server/src/services/lyricTagProbe.ts for the actual logic. Useful for headless runs.
 * Requires ACE-Step already running:
 *
 *   cd server && npm run probe:tags
 *
 * Runs indefinitely (each sample is merged and persisted to server/data/lyricTags.json
 * immediately, so progress is never lost) — stop with Ctrl+C.
 */
import { runProbe, getProbeState } from '../src/services/lyricTagProbe.js';

async function main(): Promise<void> {
  console.log('Probing indefinitely — press Ctrl+C to stop (each sample is saved as it completes).');
  await runProbe((msg) => console.log(msg));
  const { lastError } = getProbeState();
  if (lastError) {
    console.error(lastError);
    process.exitCode = 1;
  }
}

main();
