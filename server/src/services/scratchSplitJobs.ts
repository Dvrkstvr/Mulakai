/**
 * Standalone stem split: upload any audio file and get back its stems, with no
 * song/layer required. Reuses stemSplit.ts's per-stem ACE-Step/Demucs runners,
 * just writing results to a scratch OS-tmp directory instead of `config.audioDir`
 * and tracking its own job registry (a scratch job has no layerId/songId to
 * belong to). Used both as a standalone utility (split, download, done) and as
 * a source-picker step for Complete generation (pick a stem, use it as src_audio).
 */
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { acquireGenLock, releaseGenLock } from './genLock.js';
import {
  runAcestepStem, runDemucs, type SourceAudio, type StemResult, type SplitModel,
} from './stemSplit.js';
import { parseOutputSettings, type OutputSettings } from './audioOutput.js';

const STEM_KINDS: StemResult['kind'][] = ['vocals', 'drums', 'bass', 'other'];

export interface ScratchSplitJob {
  id: string;
  model: SplitModel;
  stems: StemResult[];
  output: OutputSettings;
  outDir: string;
  createdAt: number;
}

const jobs = new Map<string, ScratchSplitJob>();

export function getScratchSplitJob(id: string): ScratchSplitJob | undefined {
  return jobs.get(id);
}

export function scratchStemPath(job: ScratchSplitJob, kind: string): string | undefined {
  const stem = job.stems.find((s) => s.kind === kind && s.status === 'done' && s.audioFile);
  return stem?.audioFile ? path.join(job.outDir, stem.audioFile) : undefined;
}

/** Start a scratch split job. Unlike the layer-based startSplit(), there's no song to lock
 * against — the genLock entry exists only so this counts toward the single-flight generation
 * limit ACE-Step's own queue expects. */
export async function startScratchSplit(src: SourceAudio, model: SplitModel, output?: unknown): Promise<ScratchSplitJob> {
  const jobId = crypto.randomUUID();
  const outDir = path.join(os.tmpdir(), `mulakai-split-${jobId}`);
  await fs.mkdir(outDir, { recursive: true });
  acquireGenLock({ kind: 'split', jobId });
  const job: ScratchSplitJob = {
    id: jobId,
    model,
    stems: STEM_KINDS.map((kind) => ({ kind, status: 'running' })),
    output: parseOutputSettings(output),
    outDir,
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);

  const isActive = () => jobs.has(jobId);
  const settled = model === 'acestep'
    ? Promise.all(STEM_KINDS.map((kind) => runAcestepStem(job, kind, src, outDir, isActive)))
    : runDemucs(job, src, outDir, isActive);
  void settled.finally(() => releaseGenLock(jobId));

  return job;
}

/** Discard a scratch job and its temp files — no retention policy beyond "the user is done
 * with it" (explicit discard, or the process exiting); nothing here is ever added to the library. */
export async function discardScratchSplit(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  jobs.delete(jobId);
  await fs.rm(job?.outDir ?? path.join(os.tmpdir(), `mulakai-split-${jobId}`), { recursive: true, force: true });
}
