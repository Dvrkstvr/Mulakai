/**
 * PLAN on the SCORE verb (F-019): start a plan job for a song and read where it stands.
 *   POST /api/songs/:id/score/plan {request}  → 202 {jobId, queuePosition}
 *   GET  /api/songs/:id/score/plan            → {run, plan}
 *   POST /api/songs/:id/score/plan/cancel     → CANCEL: a queued plan leaves the line; a running
 *        one aborts its planner call and still unloads before the slot frees (F-024 #2, D-041)
 * The plan itself stays on the server (planStore, D-035); its edited score is not sent.
 */
import { Router } from 'express';
import { config } from '../config.js';
import { QueueFullError, getRunning, queuePosition } from '../services/genQueue.js';
import { abortJob, getJob } from '../services/jobRegistry.js';
import { planDeps, startPlan, type PlanDeps } from '../services/score/planJob.js';
import { getPlan, lastRun } from '../services/score/planStore.js';
import type { Plan } from '../services/score/planTypes.js';

export const REQUEST_MAX = 500;
export const NOT_SET_UP = 'the score planner is not set up: set LLM_API_URL to a local Ollama';
export const ALREADY_PLANNING = 'a plan is already queued or running for this song';
export const NOTHING_TO_CANCEL = 'no plan is queued or running for this song';

/** What the dock reads of a plan: its ops, verdicts (with a section op's lyric `note` and a
 * REWRITE_LYRICS `diff`, F-030 #3, F-031 #1), checks and refusals; never the edited score or lyrics. */
export type PlanView = Omit<Plan, 'abc' | 'fingerprint' | 'lyrics'>;
const planView = ({ abc: _abc, fingerprint: _fp, lyrics: _lyrics, ...plan }: Plan): PlanView => plan;

export function makeScorePlanRouter(deps: () => PlanDeps = () => planDeps()): Router {
  const router = Router();

  router.post('/:id/score/plan', async (req, res) => {
    const songId = req.params.id;
    const request = typeof req.body?.request === 'string' ? req.body.request.trim() : '';
    if (!request) return res.status(400).json({ error: 'say what to change' });
    if (request.length > REQUEST_MAX) return res.status(400).json({ error: `keep the request under ${REQUEST_MAX} characters` });
    if (!config.llmUrl) return res.status(409).json({ error: NOT_SET_UP });
    const prior = lastRun(songId);
    const priorJob = prior && getJob(prior.jobId);
    if (priorJob && (priorJob.status === 'queued' || priorJob.status === 'running')) {
      return res.status(409).json({ error: ALREADY_PLANNING, jobId: priorJob.id });
    }
    const d = deps();
    try {
      const status = await d.status(songId);
      if (!status.source) return res.status(404).json({ error: 'unknown song' });
      if (status.eligibility.state !== 'eligible') {
        const reason = 'reason' in status.eligibility ? status.eligibility.reason : 'SCORE is not available for this song';
        return res.status(409).json({ error: reason, eligibility: status.eligibility });
      }
      const job = startPlan(songId, request, d);
      res.status(202).json({ jobId: job.id, queuePosition: queuePosition(job.id) ?? 0 });
    } catch (err) {
      if (err instanceof QueueFullError) return res.status(409).json({ error: err.message });
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get('/:id/score/plan', (req, res) => {
    const songId = req.params.id;
    const run = lastRun(songId);
    const job = run && getJob(run.jobId);
    const plan = getPlan(songId);
    res.json({
      run: run && job ? {
        jobId: job.id, request: run.request, status: job.status, progressText: job.progressText,
        ...(job.status === 'queued' ? { queuePosition: queuePosition(job.id) } : {}),
        error: job.error, reasons: run.reasons, planId: run.planId, ...(job.cancelled ? { cancelled: true } : {}),
        // An aborted plan reads failed at once but holds the slot until the unload is confirmed:
        // its cause stays null until then, so the dock keeps saying CANCELLING.
        cause: job.cancelled ? 'cancelled'
          : run.cause ?? (job.status === 'failed' && getRunning()?.jobId !== job.id ? 'cancelled' : null),
      } : null,
      plan: plan ? planView(plan) : null,
    });
  });

  router.post('/:id/score/plan/cancel', (req, res) => {
    const run = lastRun(req.params.id);
    const job = run && getJob(run.jobId);
    if (!job || (job.status !== 'queued' && job.status !== 'running')) return res.status(404).json({ error: NOTHING_TO_CANCEL });
    const queued = job.status === 'queued';
    abortJob(job.id);
    res.json({ ok: true, ...(queued ? { cancelled: true } : { aborted: true }) });
  });

  return router;
}

export const scorePlanRouter = makeScorePlanRouter();
