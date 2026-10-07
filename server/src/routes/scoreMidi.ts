/**
 * A score as a MIDI file (PLAN.md "Export a Score as MIDI"), mounted on /api:
 *   POST /scores/midi            {abc}: a cover's score in Create, or an .abc file from disk
 *   GET  /songs/:id/score/midi   the song's active base version's score sidecar
 * yue-server converts (decision 0002). 422 carries the parser's reason; 404 a take with no
 * score; 502 a yue-server that is unset, down or failing.
 */
import { Router, type Response } from 'express';
import { loadScoreSource } from '../services/score/scoreSource.js';
import { scoreToMidi, ScoreMidiRefused } from '../services/score/yueScoreMidi.js';

/** Same cap as a cover's score (engineCovers.ts). */
const MAX_SCORE_BYTES = 65_536;

export interface ScoreMidiDeps {
  convert: (abc: string) => Promise<Buffer>;
  songScore: (songId: string) => Promise<string | null>;
}

const defaults = (): ScoreMidiDeps => ({
  convert: (abc) => scoreToMidi(abc),
  songScore: async (songId) => (await loadScoreSource(songId))?.abc ?? null,
});

async function send(res: Response, deps: ScoreMidiDeps, abc: string) {
  try {
    res.type('audio/midi').send(await deps.convert(abc));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(err instanceof ScoreMidiRefused ? 422 : 502).json({ error: message });
  }
}

export function makeScoreMidiRouter(deps: () => ScoreMidiDeps = defaults): Router {
  const router = Router();

  router.post('/scores/midi', async (req, res) => {
    const abc = typeof req.body?.abc === 'string' ? req.body.abc : '';
    if (!abc.trim() || Buffer.byteLength(abc, 'utf8') > MAX_SCORE_BYTES) {
      return res.status(400).json({ error: 'abc must be a score within 64 KB' });
    }
    await send(res, deps(), abc);
  });

  router.get('/songs/:id/score/midi', async (req, res) => {
    const d = deps();
    const abc = await d.songScore(req.params.id);
    if (!abc) return res.status(404).json({ error: 'this take has no score' });
    await send(res, d, abc);
  });

  return router;
}

export const scoreMidiRouter = makeScoreMidiRouter();
