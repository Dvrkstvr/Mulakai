/**
 * Stem separation orchestration for the SPLIT feature. Two backends:
 * - ACE-Step's `extract` task isolates one track per call (docs/ace-step-1.5/
 *   GUIDE.md#Task Types), so getting all 4 stems fans out 4 concurrent
 *   generation jobs, each settling independently.
 * - Demucs runs as a separate HTTP microservice (like ACESTEP_API_URL). Its
 *   request/response contract (stemSplitDemucs.ts) is provisional pending the real repo.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { parseOutputSettings, type OutputSettings } from './audioOutput.js';
import { acquireGenLock, releaseGenLock } from './genLock.js';
import {
  STEM_KINDS, INSTRUCTIONS, type StemKind, type SplitModel, type StemResult, type SourceAudio,
} from './stemSplitTypes.js';
import { runAcestepStem } from './stemSplitAcestep.js';
import { runDemucs } from './stemSplitDemucs.js';

export type { StemKind, SplitModel, StemResult, StemJobLike, SourceAudio } from './stemSplitTypes.js';
export { runAcestepStem } from './stemSplitAcestep.js';
export { runDemucs } from './stemSplitDemucs.js';

export interface SplitJob {
  id: string;
  layerId: string;
  songId: string;
  model: SplitModel;
  stems: StemResult[];
  output: OutputSettings;
  createdAt: number;
}

const jobs = new Map<string, SplitJob>();

export function getSplitJob(id: string): SplitJob | undefined {
  return jobs.get(id);
}

async function loadSourceAudio(layerId: string): Promise<SourceAudio & { songId: string }> {
  const row = db
    .prepare(
      `SELECT v.audio_file, l.song_id FROM versions v
       JOIN layers l ON v.layer_id = l.id
       WHERE l.id = ? AND v.active = 1`,
    )
    .get(layerId) as { audio_file: string; song_id: string } | undefined;
  if (!row) throw new Error('unknown layer');
  const data = await fs.readFile(path.join(config.audioDir, row.audio_file));
  return { data, filename: row.audio_file, songId: row.song_id };
}

/** Start a split job: reads the layer's active audio and fans out both backends' extraction paths. */
export async function startSplit(layerId: string, model: SplitModel, output?: unknown): Promise<SplitJob> {
  const src = await loadSourceAudio(layerId);
  const jobId = crypto.randomUUID();
  acquireGenLock({ kind: 'split', jobId, songId: src.songId });
  const job: SplitJob = {
    id: jobId,
    layerId,
    songId: src.songId,
    model,
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
 * Re-run a single stem in place (fresh seed for ACE-Step). Rejected once the
 * stem is claimed — a locked row can't be re-extracted either. Demucs has no
 * single-stem endpoint yet, so it re-runs the full pass and keeps only this
 * stem's output, same provisional-contract caveat as `runDemucs`.
 */
export function reextractStem(jobId: string, kind: StemKind): StemResult {
  const job = jobs.get(jobId);
  if (!job) throw new Error('unknown split job');
  const stem = job.stems.find((s) => s.kind === kind);
  if (!stem) throw new Error('unknown stem');
  if (stem.claimed) throw new Error('stem already claimed');
  const lockId = crypto.randomUUID();
  acquireGenLock({ kind: 'split', jobId: lockId, songId: job.songId });
  stem.status = 'running';
  stem.error = undefined;
  const isActive = () => jobs.has(job.id);
  void loadSourceAudio(job.layerId)
    .then((src) => (job.model === 'acestep' ? runAcestepStem(job, kind, src, config.audioDir, isActive) : runDemucs(job, src, config.audioDir, isActive)))
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

/** Abandon a split job. In-flight ACE-Step/Demucs calls can't be aborted server-side — their results are simply ignored when they land, same as elsewhere in the job orchestrator having no cancel primitive. */
export function cancelSplit(jobId: string): void {
  jobs.delete(jobId);
}
