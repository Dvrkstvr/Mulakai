import { Router } from 'express';
import { getStoredTags, getProbeState, runProbe, stopProbe } from '../services/lyricTagProbe.js';

export const lyricTagsRouter = Router();

lyricTagsRouter.get('/', (_req, res) => {
  res.json({ tags: getStoredTags() });
});

lyricTagsRouter.get('/status', (_req, res) => {
  res.json(getProbeState());
});

/** Fire-and-forget: the probe runs indefinitely (many sequential LM calls) until stopped,
 * so this returns immediately and the client polls GET /status for progress. */
lyricTagsRouter.post('/probe', (_req, res) => {
  if (getProbeState().running) {
    return res.status(409).json({ error: 'Probe already running' });
  }
  runProbe().catch(() => {}); // failure is recorded on probe state; nothing to do with it here
  res.json({ status: 'started' });
});

lyricTagsRouter.post('/probe/stop', (_req, res) => {
  stopProbe();
  res.json({ status: 'stopping' });
});
