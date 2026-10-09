/**
 * The chat's APPLY job (F-047, F-049 #1; D-101, D-107, D-154): kind `scoreRender`, label `chat edit`, one slot
 * for every step. At its turn it re-checks the plan (checkRender: a refusal starts no engine job), then:
 * - REHARMONIZE: renders the edited score (scoreRenderRun), then splices the span of that render into the base
 *   on yue-server (`/v1/splices`, the render job's audio stays there);
 * - CUT / REPEAT: splices the base's own audio, with no render;
 * - anything else (spliceEligibility said so on the card): renders the whole song.
 * A splice verdict `rerender` or a refused splice saves the whole render instead, labelled with the reason (a
 * CUT / REPEAT renders it then), never a silent splice; a failed splice or a cancel saves nothing and keeps the
 * plan (the card returns to pending). Every exit cancels the yue splice job: that stops a queued or running
 * splice, but a finished one is untouched (cancel is a no-op), so its spliced WAV and grids stay on yue-server
 * until its retention sweep removes them.
 * `job.progressText` is the phase the thread shows: rendering, splicing, saving.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config.js';
import { db } from '../../db/index.js';
import { fetchAudio, fetchScore } from '../engineClient.js';
import { ABORTED_AFTER_SAVE, drainWhile, queueJob } from '../jobRunner.js';
import { wasAborted, type Job } from '../jobRegistry.js';
import { songTitle } from '../queueGuards.js';
import { dropPlan, noteRender, type RenderRun } from '../score/planStore.js';
import type { Plan } from '../score/planTypes.js';
import { checkRender, type RenderDeps } from '../score/scoreRenderJob.js';
import { runScoreRender, scoreRequest, type RenderedTake } from '../score/scoreRenderRun.js';
import type { ScoreSource } from '../score/scoreSource.js';
import { persistScoreVersion, type SavedScoreVersion, type SpliceRecord } from '../score/scoreVersion.js';
import { readGrid, writeGrid } from './gridCache.js';
import type { Splice, SpliceKind } from './spliceEligibility.js';
import { fallbackReason } from './versionCard.js';
import { cancelSplice, fetchSpliceAudio, fetchSpliceGrid, spliceStatus, submitSplice, SpliceRefused, type SpliceResult } from './yueSpliceClient.js';

export interface EditSaved { version: SavedScoreVersion; splice?: SpliceRecord; previous: { versionId: string; number: number } | null }
export type OnEditSaved = (saved: EditSaved) => void;

type Spliced = { result: SpliceResult; spliceId: string } | { refused: string };

/** The base version's audio file and its place in the base layer (v1 = 1), or null once it is gone. */
function baseFile(plan: Plan): { file: string; number: number } | null {
  const row = db.prepare(`SELECT audio_file, layer_id FROM versions WHERE id = ?`).get(plan.baseVersionId) as { audio_file: string; layer_id: string } | undefined;
  if (!row) return null;
  const ids = (db.prepare(`SELECT id FROM versions WHERE layer_id = ? ORDER BY created_at, rowid`).all(row.layer_id) as Array<{ id: string }>).map((r) => r.id);
  return { file: row.audio_file, number: ids.indexOf(plan.baseVersionId) + 1 };
}

const record = (r: SpliceResult, kind: SpliceKind): SpliceRecord => ({
  splice_v: 1, kind, bars: r.bars, joins_s: r.joins_s, crossfade_s: r.crossfade_s, gain_db: r.gain_db,
  snap_ms: r.snap.map((s) => s.delta_ms), length_diff_s: r.length_diff_s, null_test: r.null_test,
});

/** Splice on yue-server and wait for its verdict; null once our job was aborted. `ids` collects the yue job id. */
async function splice(job: Job, deps: RenderDeps, plan: Plan, source: ScoreSource, take: RenderedTake | null, ids: string[]): Promise<Spliced | null> {
  job.progressText = 'splicing';
  job.status = 'running';
  const base = baseFile(plan);
  if (!base) throw new Error('the version this edit was planned on is gone');
  const audio = await fs.readFile(path.join(config.audioDir, base.file));
  const grid = await readGrid(plan.baseVersionId);
  const spec = { op: plan.ops[0], base_abc: source.abc ?? '', ...(take ? { render_job: take.taskId } : {}), edited_abc: plan.abc, ...(grid ? { base_grid: grid } : {}) };
  try {
    ids.push(await submitSplice(deps.target, audio, base.file, spec, job.id));
  } catch (err) {
    if (err instanceof SpliceRefused) return { refused: `yue-server would not splice it: ${err.message}` };
    throw err;
  }
  console.info(`chat edit ${job.id}: splice ${ids[0]} on ${audio.length} bytes of base audio`);
  for (;;) {
    await new Promise((r) => setTimeout(r, config.pollIntervalMs));
    if (wasAborted(job)) return null;
    const state = await spliceStatus(deps.target, ids[0]);
    if (state.state === 'failed') throw new Error(`the splice failed: ${state.error}`);
    if (state.state === 'done') return { result: state.result, spliceId: ids[0] };
    job.progressStage = state.stage;
  }
}

/** The steps after the re-check; returns when saved, aborted or failed (throws). */
async function apply(job: Job, songId: string, run: RenderRun, planned: Splice, onSaved: OnEditSaved, deps: RenderDeps, ids: string[]): Promise<void> {
  const checked = await checkRender(songId, run.planId, deps, false);
  if ('refusal' in checked) {
    run.refused = checked.refusal;
    throw new Error(checked.refusal);
  }
  const { plan, source } = checked;
  const previous = baseFile(plan);
  /** Save the version (the phase line reads SAVING; a cancel from here cannot unsave it). */
  const save = async (audio: Buffer, score: string | null, request: RenderedTake['request'], truncated: boolean, rec?: SpliceRecord) => {
    if (wasAborted(job)) return null;
    job.progressText = 'saving';
    const version = await persistScoreVersion({ songId, plan, source, request, audio, score, truncated, ...(rec ? { splice: rec } : {}) });
    run.version = version;
    dropPlan(songId);
    onSaved({ version, splice: rec, previous: previous ? { versionId: plan.baseVersionId, number: previous.number } : null });
    return version;
  };
  const render = async () => {
    job.progressText = 'rendering';
    return runScoreRender(job, deps.target, plan, source);
  };
  const saveTake = async (take: RenderedTake, rec?: SpliceRecord) =>
    save(await fetchAudio(deps.target, take.taskId), await fetchScore(deps.target, take.taskId).catch(() => null), take.request, take.truncated, rec);

  if (planned.splice && planned.kind === 'several') { // C4 interim: CK-3 sends the chain (spec v2); never splice one span of it
    const whole = await render();
    return void (whole && (await saveTake(whole, { splice_v: 1, fallback: 'several spans are not spliced one after another yet' })));
  }
  let take: RenderedTake | null = null;
  if (!planned.splice || planned.kind === 'reharmonize') {
    take = await render();
    if (!take || !planned.splice) return void (take && (await saveTake(take)));
  }
  const out = await splice(job, deps, plan, source, take, ids);
  if (!out) return;
  if ('refused' in out || out.result.verdict === 'rerender') {
    const fallback = { splice_v: 1 as const, fallback: 'refused' in out ? out.refused : fallbackReason(out.result) };
    take = take ?? (await render());
    return void (take && (await saveTake(take, fallback)));
  }
  const audio = await fetchSpliceAudio(deps.target, out.spliceId);
  const [baseGrid, outGrid] = await Promise.all(['base', 'out'].map((w) => fetchSpliceGrid(deps.target, out.spliceId, w as 'base' | 'out')));
  const version = await save(audio, plan.abc, take?.request ?? scoreRequest(plan, source), false, record(out.result, planned.kind));
  if (!version) return;
  if (!(await readGrid(plan.baseVersionId))) await writeGrid(plan.baseVersionId, baseGrid).catch(() => false);
  await writeGrid(version.id, outGrid).catch(() => false);
}

/** Queues APPLY of `planId`; the caller ran checkRender at the click. Throws QueueFullError.
 * `onUnsaved`: the job ended (failed, refused or cancelled) with no version saved. */
export function startEditRender(songId: string, planId: string, planned: Splice, onSaved: OnEditSaved, deps: RenderDeps, onUnsaved?: () => void): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'queued', createdAt: Date.now(), songId };
  const run: RenderRun = { jobId: job.id, planId, refused: null, version: null };
  noteRender(songId, run);
  const ids: string[] = [];
  return queueJob({ kind: 'scoreRender', songId, title: songTitle(songId), label: 'chat edit' }, job, async () => {
    try {
      await apply(job, songId, run, planned, onSaved, deps, ids);
    } finally {
      if (!run.version) onUnsaved?.();
      if (ids[0]) {
        await cancelSplice(deps.target, ids[0]);
        if (wasAborted(job)) await drainWhile(async () => (await spliceStatus(deps.target, ids[0])).state === 'running');
      }
    }
    if (!run.version) return; // aborted: the abort already settled the job, nothing saved
    if (wasAborted(job)) {
      job.error = ABORTED_AFTER_SAVE; // a save in progress cannot be taken back
      job.cancelled = false; // so it does not read as a cancel that saved nothing
    }
    else job.status = 'done';
  });
}
