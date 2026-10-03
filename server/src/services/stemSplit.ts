/**
 * The layer-bound SPLIT job: separate a layer's active audio into 4 stems, then
 * claim each one as a new version (REPLACE) or a new layer (ADD LAYER), or
 * RE-EXTRACT it. The per-stem runners live in stemRunners.ts, shared with the
 * upload-based scratch split.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { parseOutputSettings, type OutputSettings } from './audioOutput.js';
import { cancelQueued, enqueue } from './genQueue.js';
import { activeLayerSource, layerName } from './queueGuards.js';
import { discardUnclaimedFile, failRunning } from './stemFiles.js';
import {
  runAcestepStem, runDemucs, STEM_KINDS, INSTRUCTIONS,
  type StemKind, type SplitModel, type StemResult, type SourceAudio,
} from './stemRunners.js';

export type { StemKind, SplitModel, StemResult } from './stemRunners.js';

export interface SplitJob {
  id: string;
  layerId: string;
  songId: string;
  model: SplitModel;
  /** The audio_file the split began from — RE-EXTRACT reads this, not whatever is
   * active on the layer by then (a REPLACE makes a claimed stem the active audio). */
  sourceFile: string;
  stems: StemResult[];
  output: OutputSettings;
  createdAt: number;
  /** Last status poll, claim or RE-EXTRACT — the idle clock evictIdleSplits reads. */
  lastSeenAt: number;
  /** Waiting in genQueue.ts; its stems read `running` meanwhile. */
  queued?: boolean;
}

/** An open session is polled every 2 s (even outside the Editor), so an hour without a
 * touch means its tab is gone — see PLAN.md "Abandoned Splits Leave No Stems Behind". */
export const SPLIT_IDLE_TTL_MS = 60 * 60 * 1000;

const jobs = new Map<string, SplitJob>();

/** Look a job up for a client request, which also restarts its idle clock. */
export function getSplitJob(id: string): SplitJob | undefined {
  const job = jobs.get(id);
  if (job) job.lastSeenAt = Date.now();
  return job;
}

export function isLiveSplit(id: string): boolean {
  return jobs.has(id);
}

function readSource(file: string): Promise<SourceAudio> {
  return fs.readFile(path.join(config.audioDir, file)).then((data) => ({ data, filename: file }));
}

/** Queue a split job. When its turn comes it reads the layer's active audio *then* and fans out
 * the chosen backend's extraction, holding the queue's slot until every stem call settles (all 4
 * for ACE-Step, the single batched call for Demucs). CANCEL while queued drops the session. */
export async function startSplit(layerId: string, model: SplitModel, output?: unknown): Promise<SplitJob> {
  const first = activeLayerSource(layerId, 'unknown layer');
  const jobId = crypto.randomUUID();
  const job: SplitJob = {
    id: jobId,
    layerId,
    songId: first.song_id,
    model,
    sourceFile: first.audio_file,
    stems: STEM_KINDS.map((kind) => ({ kind, status: 'running' })),
    output: parseOutputSettings(output),
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    queued: true,
  };
  const isActive = () => jobs.has(jobId);
  const label = `split ${model === 'demucs' ? 'demucs' : 'ace-step'}`;
  jobs.set(jobId, job);
  try {
    enqueue({ kind: 'split', jobId, songId: first.song_id, layer: layerName(layerId), label }, async () => {
      job.queued = false;
      if (!isActive()) return;
      try {
        const row = activeLayerSource(layerId);
        job.sourceFile = row.audio_file;
        const src = await readSource(row.audio_file);
        await (model === 'acestep'
          ? Promise.all(STEM_KINDS.map((kind) => runAcestepStem(job, kind, src, config.audioDir, isActive)))
          : runDemucs(job, src, config.audioDir, isActive));
      } catch (err) {
        failRunning(job.stems, err);
      }
    }, () => { jobs.delete(jobId); }, () => void cancelSplit(jobId));
  } catch (err) {
    jobs.delete(jobId);
    throw err;
  }
  return job;
}

/**
 * Queue a re-run of a single stem (fresh seed for ACE-Step) from the split's original source.
 * Rejected once the stem is claimed. Demucs has no single-stem endpoint, so it re-runs
 * the full pass and keeps only this stem's output. The new audio lands under a new
 * filename; the superseded one (never claimed) is deleted once it's replaced.
 */
export function reextractStem(jobId: string, kind: StemKind): StemResult {
  const job = getSplitJob(jobId);
  if (!job) throw new Error('unknown split job');
  const stem = job.stems.find((s) => s.kind === kind);
  if (!stem) throw new Error('unknown stem');
  if (stem.claimed) throw new Error('stem already claimed');
  if (stem.status === 'running') throw new Error('stem is still running');
  const previous = stem.audioFile;
  // ABORT on a running re-extract drops only this stem's new take; the session stays open.
  let aborted = false;
  const isActive = () => jobs.has(job.id) && !aborted;
  const info = { kind: 'split' as const, jobId: crypto.randomUUID(), songId: job.songId, layer: layerName(job.layerId), label: `re-extract ${kind}` };
  const prior = { status: stem.status, error: stem.error };
  stem.status = 'running';
  stem.error = undefined;
  try {
    enqueue(info, () => {
      if (!isActive()) return undefined;
      return readSource(job.sourceFile)
        .then((src) => (job.model === 'acestep'
          ? runAcestepStem(job, kind, src, config.audioDir, isActive)
          : runDemucs(job, src, config.audioDir, isActive, [kind])))
        .then(() => (stem.audioFile !== previous ? discardUnclaimedFile(previous) : undefined))
        .catch((err) => failRunning([stem], err));
    }, (reason) => failRunning([stem], new Error(reason)), () => {
      aborted = true;
      Object.assign(stem, prior); // back to its last result
    });
  } catch (err) {
    Object.assign(stem, prior); // the queue was full: the stem keeps its last result
    throw err;
  }
  return stem;
}

/** Replace the layer's audio (new revertible version) or add the stem as a brand-new layer. */
export function claimStem(jobId: string, kind: StemKind, action: 'replace' | 'add-layer'): { songId: string } {
  const job = getSplitJob(jobId);
  if (!job) throw new Error('unknown split job');
  const stem = job.stems.find((s) => s.kind === kind);
  if (!stem) throw new Error('unknown stem');
  if (stem.claimed) throw new Error('stem already claimed');
  if (stem.status !== 'done' || !stem.audioFile) throw new Error('stem not ready');

  const label = `split: extract ${kind}`;
  const paramsJson = JSON.stringify({ task_type: 'extract', instruction: INSTRUCTIONS[kind], model: job.model });

  if (action === 'replace') {
    const versionId = crypto.randomUUID();
    db.prepare(`UPDATE versions SET active = 0 WHERE layer_id = ?`).run(job.layerId);
    db.prepare(
      `INSERT INTO versions (id, layer_id, audio_file, label, params_json, seed, active)
       VALUES (?, ?, ?, ?, ?, '', 1)`,
    ).run(versionId, job.layerId, stem.audioFile, label, paramsJson);
  } else {
    const layerId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const { maxPos } = db
      .prepare(`SELECT COALESCE(MAX(position), -1) as maxPos FROM layers WHERE song_id = ?`)
      .get(job.songId) as { maxPos: number };
    db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, ?, ?, ?)`)
      .run(layerId, job.songId, kind[0].toUpperCase() + kind.slice(1), kind, maxPos + 1);
    db.prepare(
      `INSERT INTO versions (id, layer_id, audio_file, label, params_json, seed)
       VALUES (?, ?, ?, ?, ?, '')`,
    ).run(versionId, layerId, stem.audioFile, label, paramsJson);
  }

  stem.claimed = action === 'replace' ? 'replaced' : 'added';
  return { songId: job.songId };
}

/** Abandon a split job and delete its unclaimed stem files. In-flight ACE-Step/Demucs calls
 * can't be aborted server-side — their results are dropped when they land (see stemRunners.ts). */
export async function cancelSplit(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  jobs.delete(jobId);
  cancelQueued(jobId);
  if (!job) return;
  await Promise.all(job.stems.filter((s) => !s.claimed).map((s) => discardUnclaimedFile(s.audioFile)));
}

/** Cancel every split nobody has touched for SPLIT_IDLE_TTL_MS — a closed tab never sends
 * CANCEL SPLIT, so this is what bounds the map and removes its unclaimed stems. */
export async function evictIdleSplits(now = Date.now()): Promise<void> {
  const idle = [...jobs.values()].filter((j) => now - j.lastSeenAt > SPLIT_IDLE_TTL_MS);
  await Promise.all(idle.map((j) => cancelSplit(j.id)));
}
