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
import { acquireGenLock, releaseGenLock } from './genLock.js';
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
}

const jobs = new Map<string, SplitJob>();

export function getSplitJob(id: string): SplitJob | undefined {
  return jobs.get(id);
}

function readSource(file: string): Promise<SourceAudio> {
  return fs.readFile(path.join(config.audioDir, file)).then((data) => ({ data, filename: file }));
}

/** Delete a stem file no version points at. The DB check, not the in-memory `claimed`
 * flag, is what guards claimed audio here. */
async function discardUnclaimedFile(file: string | undefined): Promise<void> {
  if (!file) return;
  const ref = db.prepare(`SELECT 1 FROM versions WHERE audio_file = ? LIMIT 1`).get(file);
  if (ref) return;
  await fs.rm(path.join(config.audioDir, file), { force: true }).catch(() => {});
}

/** Start a split job: reads the layer's active audio and fans out the chosen backend's extraction. */
export async function startSplit(layerId: string, model: SplitModel, output?: unknown): Promise<SplitJob> {
  const row = db
    .prepare(
      `SELECT v.audio_file, l.song_id FROM versions v
       JOIN layers l ON v.layer_id = l.id
       WHERE l.id = ? AND v.active = 1`,
    )
    .get(layerId) as { audio_file: string; song_id: string } | undefined;
  if (!row) throw new Error('unknown layer');
  const src = await readSource(row.audio_file);
  const jobId = crypto.randomUUID();
  acquireGenLock({ kind: 'split', jobId, songId: row.song_id });
  const job: SplitJob = {
    id: jobId,
    layerId,
    songId: row.song_id,
    model,
    sourceFile: row.audio_file,
    stems: STEM_KINDS.map((kind) => ({ kind, status: 'running' })),
    output: parseOutputSettings(output),
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);

  // Held until every stem call settles (all 4 for ACE-Step, the single batched call for Demucs) —
  // reextractStem acquires its own lock for any stem re-run after this point.
  const isActive = () => jobs.has(jobId);
  const settled = model === 'acestep'
    ? Promise.all(STEM_KINDS.map((kind) => runAcestepStem(job, kind, src, config.audioDir, isActive)))
    : runDemucs(job, src, config.audioDir, isActive);
  void settled.finally(() => releaseGenLock(jobId));

  return job;
}

/**
 * Re-run a single stem (fresh seed for ACE-Step) from the split's original source.
 * Rejected once the stem is claimed. Demucs has no single-stem endpoint, so it re-runs
 * the full pass and keeps only this stem's output. The new audio lands under a new
 * filename; the superseded one (never claimed) is deleted once it's replaced.
 */
export function reextractStem(jobId: string, kind: StemKind): StemResult {
  const job = jobs.get(jobId);
  if (!job) throw new Error('unknown split job');
  const stem = job.stems.find((s) => s.kind === kind);
  if (!stem) throw new Error('unknown stem');
  if (stem.claimed) throw new Error('stem already claimed');
  if (stem.status === 'running') throw new Error('stem is still running');
  const lockId = crypto.randomUUID();
  acquireGenLock({ kind: 'split', jobId: lockId, songId: job.songId });
  const previous = stem.audioFile;
  stem.status = 'running';
  stem.error = undefined;
  const isActive = () => jobs.has(job.id);
  void readSource(job.sourceFile)
    .then((src) => (job.model === 'acestep'
      ? runAcestepStem(job, kind, src, config.audioDir, isActive)
      : runDemucs(job, src, config.audioDir, isActive, [kind])))
    .then(() => (stem.audioFile !== previous ? discardUnclaimedFile(previous) : undefined))
    .catch((err) => {
      stem.status = 'failed';
      stem.error = err instanceof Error ? err.message : String(err);
    })
    .finally(() => releaseGenLock(lockId));
  return stem;
}

/** Replace the layer's audio (new revertible version) or add the stem as a brand-new layer. */
export function claimStem(jobId: string, kind: StemKind, action: 'replace' | 'add-layer'): { songId: string } {
  const job = jobs.get(jobId);
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
  if (!job) return;
  await Promise.all(job.stems.filter((s) => !s.claimed).map((s) => discardUnclaimedFile(s.audioFile)));
}
