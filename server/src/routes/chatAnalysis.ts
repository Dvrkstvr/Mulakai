/**
 * The chat player's analysis (F-052, F-053, D-179; architecture.md "Chat (C1)"): `GET /songs/:songId/analysis`
 * → `AnalysisView` (the playable take's state, the reading the strip shows, its lineage for the mark), and
 * `POST /songs/:songId/analysis/retry` → 202 `{jobId}` (a waiting analysis is returned, not doubled) or 409
 * `{reason}` (no take, already read, the queue is full; a reading whose service failed is not "read", C1 live B1). C1b adds the mark preview here.
 */
import { Router } from 'express';
import { db } from '../db/index.js';
import { QueueFullError } from '../services/genQueue.js';
import type { Job } from '../services/jobRegistry.js';
import { liveAnalysis, startAnalysis } from '../services/chat/analysisJob.js';
import { playableVersion, readingChain, readVersionAnalysis, wordTimings } from '../services/chat/analysisStore.js';
import { isComplete, type AnalysisView } from '../services/chat/analysisTypes.js';
import { analysisView } from '../services/chat/analysisView.js';

export interface ChatAnalysisDeps {
  start: (songId: string) => Job;
}
const defaults: ChatAnalysisDeps = { start: (songId) => startAnalysis(songId) };

const songLive = (songId: string) => Boolean(db.prepare(`SELECT 1 FROM songs WHERE id = ? AND trashed_at IS NULL`).get(songId));

export function songAnalysisView(songId: string): AnalysisView {
  const playable = playableVersion(songId);
  const chain = playable ? readingChain(playable.id) : { older: null, olderShift: { moved: false } as const, parent: null };
  return analysisView({
    songId, playable,
    current: playable ? readVersionAnalysis(playable.id) : null,
    currentWords: playable ? wordTimings(playable.id) : null,
    older: chain.older, olderShift: chain.olderShift, parent: chain.parent,
    job: liveAnalysis(songId),
  });
}

export function makeChatAnalysisRouter(deps: ChatAnalysisDeps = defaults): Router {
  const router = Router();

  router.get('/songs/:songId/analysis', (req, res) => {
    if (!songLive(req.params.songId)) return res.status(404).json({ error: 'unknown song' });
    res.json(songAnalysisView(req.params.songId));
  });

  router.post('/songs/:songId/analysis/retry', (req, res) => {
    const { songId } = req.params;
    if (!songLive(songId)) return res.status(404).json({ error: 'unknown song' });
    const take = playableVersion(songId);
    if (!take) return res.status(409).json({ reason: 'this song has no take to read' });
    const stored = readVersionAnalysis(take.id);
    if (isComplete(stored)) return res.status(409).json({ reason: `v${take.number} is already read` });
    try {
      res.status(202).json({ jobId: deps.start(songId).id });
    } catch (err) {
      if (!(err instanceof QueueFullError)) throw err;
      res.status(409).json({ reason: err.message });
    }
  });

  return router;
}

export const chatAnalysisRouter = makeChatAnalysisRouter();
