/**
 * Re-time a transcription (PLAN.md "Re-time a Transcription", F-090), mounted on /api:
 *   GET  /scores/notation/:id   is the transcription's kept reading still here? (the refusal before a press, D-207)
 *   POST /scores/retime         {notationId, mode: half | double | bpm, bpm?}: the score rebuilt from it
 * yue-server rebuilds (decision 0002). 404 `no_bundle` when the kept files are gone (the UI offers TRANSCRIBE AGAIN);
 * 422 carries yue-server's `code` (out_of_range, retime_refused, ...); 502 a yue-server that is unset, down or failing.
 */
import { Router } from 'express';
import { loadNotation } from '../services/notationStore.js';
import { retimeScore, RetimeRefused, type NotationBundle, type RetimeMode, type RetimeResult } from '../services/score/yueRetime.js';

export interface ScoreRetimeDeps {
  load: (id: string) => Promise<NotationBundle | null>;
  retime: (bundle: NotationBundle, mode: RetimeMode, bpm: number | null) => Promise<RetimeResult>;
}

const defaults = (): ScoreRetimeDeps => ({ load: loadNotation, retime: (b, m, bpm) => retimeScore(b, m, bpm) });
const MODES = new Set<RetimeMode>(['half', 'double', 'bpm']);
const GONE = { code: 'no_bundle', error: 'the saved reading is gone: transcribe the source again' };

export function makeScoreRetimeRouter(deps: () => ScoreRetimeDeps = defaults): Router {
  const router = Router();

  router.get('/scores/notation/:id', async (req, res) => {
    const bundle = await deps().load(req.params.id);
    if (!bundle) return res.status(404).json(GONE);
    res.json({ chords: bundle.chords });
  });

  router.post('/scores/retime', async (req, res) => {
    const body = (req.body ?? {}) as { notationId?: unknown; mode?: unknown; bpm?: unknown };
    const mode = body.mode as RetimeMode;
    if (typeof body.notationId !== 'string' || !MODES.has(mode)) {
      return res.status(400).json({ error: 'notationId and mode (half, double or bpm) are required' });
    }
    const bpm = typeof body.bpm === 'number' && Number.isFinite(body.bpm) ? body.bpm : null;
    if (mode === 'bpm' && bpm === null) return res.status(400).json({ error: 'mode bpm needs a bpm' });
    const d = deps();
    const bundle = await d.load(body.notationId);
    if (!bundle) return res.status(404).json(GONE);
    try {
      res.json(await d.retime(bundle, mode, mode === 'bpm' ? bpm : null));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof RetimeRefused) return res.status(422).json({ code: err.code, error: message });
      res.status(502).json({ error: message });
    }
  });

  return router;
}

export const scoreRetimeRouter = makeScoreRetimeRouter();
