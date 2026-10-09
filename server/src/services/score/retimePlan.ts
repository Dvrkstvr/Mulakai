/**
 * RE-TIME in the SCORE dock (RT-4, F-093, D-240): a plan made without the planner. The score is rebuilt from the
 * transcription's kept reading at HALF, DOUBLE or a BPM (yue-server, decision 0002), keeping the sections the
 * cover sings (`keep_like`), then sized by yue-server's apply exactly as a planned score is (a SET TEMPO at the
 * new tempo changes nothing but answers the checks). The result is an ordinary planStore plan with one RETIME op,
 * so APPLY & RENDER, its re-checks and the saved version need nothing new. CPU only, a second or two.
 */
import crypto from 'node:crypto';
import { buildPlan } from './planBuild.js';
import { setPlan } from './planStore.js';
import { applyOps, type ApplyBase } from './yueScoreApply.js';
import { retimeScore, type NotationBundle, type RetimeMode, type RetimeResult } from './yueRetime.js';
import { loadNotation } from '../notationStore.js';
import { retimeOffer, READING_GONE, type RetimeOffer } from './retimeOffer.js';
import { scoreStatus, type ScoreStatus } from './scoreStatus.js';
import type { ApplyResult, Op, Plan, ScoreFacts } from './planTypes.js';

export interface RetimePlanDeps {
  status: (songId: string) => Promise<ScoreStatus>;
  offer: (songId: string) => Promise<RetimeOffer>;
  load: (notationId: string) => Promise<NotationBundle | null>;
  retime: (bundle: NotationBundle, mode: RetimeMode, bpm: number | null, keepLike: string) => Promise<RetimeResult>;
  apply: (base: ApplyBase, ops: Op[]) => Promise<ApplyResult>;
}

export const retimePlanDeps = (): RetimePlanDeps => ({
  status: (songId) => scoreStatus(songId),
  offer: (songId) => retimeOffer(songId),
  load: loadNotation,
  retime: (b, m, bpm, keep) => retimeScore(b, m, bpm, undefined, keep),
  apply: (base, ops) => applyOps(base, ops),
});

/** A refusal before any plan exists: `status` is the HTTP answer. */
export class RetimePlanRefused extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

const MODE_NAME: Record<RetimeMode, string> = { half: 'HALF TIME', double: 'DOUBLE TIME', bpm: 'BPM' };

/** The plan, not stored: the chat's RE-TIME card (RT-6) stores it only once the card is written. */
export async function buildRetimePlan(songId: string, mode: RetimeMode, bpm: number | null, deps: RetimePlanDeps = retimePlanDeps()): Promise<Plan> {
  const status = await deps.status(songId);
  const { source, read } = status;
  if (!source) throw new RetimePlanRefused(404, 'unknown song');
  if (status.eligibility.state !== 'eligible' || !source.abc || !source.activeVersionId || !read?.facts) {
    throw new RetimePlanRefused(409, 'reason' in status.eligibility ? status.eligibility.reason : 'SCORE is not available for this song');
  }
  const offer = await deps.offer(songId);
  if (offer.state === 'none') throw new RetimePlanRefused(409, 'RE-TIME is only for a cover made from a transcription');
  if (offer.state === 'refused') throw new RetimePlanRefused(409, offer.reason);
  const bundle = await deps.load(offer.notationId);
  if (!bundle) throw new RetimePlanRefused(409, READING_GONE, 'no_bundle');
  const rebuilt = await deps.retime(bundle, mode, mode === 'bpm' ? bpm : null, source.abc);
  const tempo = Math.round(rebuilt.bpm ?? 0);
  const style = source.style ?? '';
  const sized = await deps.apply({ abc: rebuilt.abc, style, lyrics: source.lyrics }, [{ op: 'SET_TEMPO', bpm: tempo }]);
  if (!sized.ok) throw new RetimePlanRefused(422, `the re-timed score does not check: ${[...sized.checks.problems, ...sized.verdicts.flatMap((v) => v.reason ?? [])].join('; ')}`, 'retime_refused');
  const op: Op = { op: 'RETIME', mode, bpm: tempo, from_bpm: offer.readBpm, dropped_notes: rebuilt.droppedNotes, notes: rebuilt.notes };
  const plan: Plan = {
    ...buildPlan({
      id: crypto.randomUUID(), createdAt: Date.now(), songId, source: { activeVersionId: source.activeVersionId, fingerprint: source.fingerprint },
      request: `RE-TIME ${MODE_NAME[mode]} · ${offer.readBpm} → ${tempo} BPM`, facts: read.facts as ScoreFacts, chordsPresent: read.chordsPresent,
      ops: [op], applied: { ...sized, verdicts: [{ index: 0, op: 'RETIME', ok: true, reason: null }] }, attempts: 0, refusals: [], // 0: no planner ran
    }),
    retime: { notationId: offer.notationId, readBpm: offer.readBpm },
  };
  return plan;
}

export async function makeRetimePlan(songId: string, mode: RetimeMode, bpm: number | null, deps: RetimePlanDeps = retimePlanDeps()): Promise<Plan> {
  const plan = await buildRetimePlan(songId, mode, bpm, deps);
  setPlan(plan);
  return plan;
}
