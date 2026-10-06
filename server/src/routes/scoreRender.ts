/**
 * APPLY & RENDER on the SCORE verb (F-023, F-024):
 *   POST /api/songs/:id/score/render {planId}  → 202 {jobId, queuePosition}, or 409 {error, stale: true}
 *        naming the plan re-check that failed (nothing started; the dock dims the plan), or 409 {error}
 *        when the planner may still hold the GPU (a loaded model or an unreadable /api/ps: the plan is
 *        fine, D-054), a render is already in flight or the queue is full (an error line with RETRY)
 *   GET  /api/songs/:id/score/render           → {run}: the song's latest render, for the dock's poll
 *   POST /api/songs/:id/score/render/cancel    → CANCEL: a queued render leaves the line; a running one
 *        is ABORTed (the slot waits for YuE2 to drain) and saves no version
 */
import { Router } from 'express';
import { QueueFullError, getRunning, queuePosition } from '../services/genQueue.js';
import { abortJob, getJob } from '../services/jobRegistry.js';
import { lastRender } from '../services/score/planStore.js';
import { checkRender, renderDeps, startScoreRender, type RenderDeps } from '../services/score/scoreRenderJob.js';

export const ALREADY_RENDERING = 'a render is already queued or running for this song';
export const NOTHING_TO_CANCEL = 'no render is queued or running for this song';

const inFlight = (status?: string) => status === 'queued' || status === 'loading' || status === 'running';

export function makeScoreRenderRouter(deps: () => RenderDeps = () => renderDeps()): Router {
  const router = Router();

  router.post('/:id/score/render', async (req, res) => {
    const songId = req.params.id;
    const planId = typeof req.body?.planId === 'string' ? req.body.planId : '';
    if (!planId) return res.status(400).json({ error: 'name the plan to render' });
    const prior = lastRender(songId);
    const priorJob = prior && getJob(prior.jobId);
    if (priorJob && inFlight(priorJob.status)) return res.status(409).json({ error: ALREADY_RENDERING, jobId: priorJob.id });
    const d = deps();
    try {
      const checked = await checkRender(songId, planId, d, true);
      if ('refusal' in checked) return res.status(409).json(checked.stale ? { error: checked.refusal, stale: true } : { error: checked.refusal });
      const job = startScoreRender(songId, planId, d);
      res.status(202).json({ jobId: job.id, queuePosition: queuePosition(job.id) ?? 0 });
    } catch (err) {
      if (err instanceof QueueFullError) return res.status(409).json({ error: err.message });
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get('/:id/score/render', (req, res) => {
    const run = lastRender(req.params.id);
    const job = run && getJob(run.jobId);
    if (!run || !job) return res.json({ run: null });
    const running = getRunning();
    const cancelled = job.status === 'failed' && !run.version && (job.cancelled === true || job.error === 'Aborted');
    res.json({
      run: {
        jobId: job.id, planId: run.planId, status: job.status,
        ...(job.status === 'queued' ? { queuePosition: queuePosition(job.id) } : {}),
        stage: job.progressStage, progress: job.progress,
        startedAt: running?.jobId === job.id ? running.startedAt : undefined,
        error: job.error, version: run.version,
        cause: run.version ? null : run.refused ? 'refused' : cancelled ? 'cancelled' : job.status === 'failed' ? 'failed' : null,
      },
    });
  });

  router.post('/:id/score/render/cancel', (req, res) => {
    const run = lastRender(req.params.id);
    const job = run && getJob(run.jobId);
    if (!job || !inFlight(job.status)) return res.status(404).json({ error: NOTHING_TO_CANCEL });
    const queued = job.status === 'queued';
    abortJob(job.id);
    res.json({ ok: true, ...(queued ? { cancelled: true } : { aborted: true }) });
  });

  return router;
}

export const scoreRenderRouter = makeScoreRenderRouter();
