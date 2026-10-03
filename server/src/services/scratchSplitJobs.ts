/**
 * Standalone stem split: upload any audio file and get back its stems, with no
 * song/layer required. Reuses stemRunners.ts's per-stem ACE-Step/Demucs runners,
 * just writing results to a scratch OS-tmp directory instead of `config.audioDir`
 * and tracking its own job registry (a scratch job has no layerId/songId to
 * belong to). Used both as a standalone utility (split, download, done) and as
 * a source-picker step for Complete generation (pick a stem, use it as src_audio).
 */
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { cancelQueued, enqueue } from './genQueue.js';
import {
  runAcestepStem, runDemucs, type SourceAudio, type StemResult, type SplitModel,
} from './stemRunners.js';
import { parseOutputSettings, type OutputSettings } from './audioOutput.js';

const STEM_KINDS: StemResult['kind'][] = ['vocals', 'drums', 'bass', 'other'];

export interface ScratchSplitJob {
  id: string;
  model: SplitModel;
  stems: StemResult[];
  output: OutputSettings;
  outDir: string;
  createdAt: number;
  /** Last client read (poll, preview, download, ANALYZE, GENERATE) — the idle clock. */
  lastSeenAt: number;
  /** Waiting in genQueue.ts; its stems read `running` meanwhile. */
  queued?: boolean;
}

/** Far longer than a layer split's hour: the picked stem is ARRANGE's source for as long as
 * the draft lives, and nothing polls it meanwhile (PLAN.md "Idle Jobs Leave Every Registry"). */
export const SCRATCH_IDLE_TTL_MS = 24 * 60 * 60 * 1000;

/** What GENERATE / ANALYZE say for a split that was discarded or evicted meanwhile. */
export const SCRATCH_GONE = "this split's stems have expired — split the file again";

const jobs = new Map<string, ScratchSplitJob>();

/** Look a job up for a client request, which also restarts its idle clock. */
export function getScratchSplitJob(id: string): ScratchSplitJob | undefined {
  const job = jobs.get(id);
  if (job) job.lastSeenAt = Date.now();
  return job;
}

export function isLiveScratchDir(dir: string): boolean {
  return [...jobs.values()].some((j) => j.outDir === dir);
}

export function scratchStemPath(job: ScratchSplitJob, kind: string): string | undefined {
  const stem = job.stems.find((s) => s.kind === kind && s.status === 'done' && s.audioFile);
  return stem?.audioFile ? path.join(job.outDir, stem.audioFile) : undefined;
}

/** Queue a scratch split job. Unlike the layer-based startSplit(), there's no song to work
 * on — the queue entry exists only so this waits its turn behind ACE-Step's other jobs, as
 * ACE-Step's own single-worker queue expects. CANCEL while queued discards it. */
export async function startScratchSplit(src: SourceAudio, model: SplitModel, output?: unknown): Promise<ScratchSplitJob> {
  const jobId = crypto.randomUUID();
  const outDir = path.join(os.tmpdir(), `mulakai-split-${jobId}`);
  await fs.mkdir(outDir, { recursive: true });
  const job: ScratchSplitJob = {
    id: jobId,
    model,
    stems: STEM_KINDS.map((kind) => ({ kind, status: 'running' })),
    output: parseOutputSettings(output),
    outDir,
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    queued: true,
  };
  jobs.set(job.id, job);

  const isActive = () => jobs.has(jobId);
  try {
    enqueue({ kind: 'split', jobId, title: src.filename, label: 'split a file' }, async () => {
      job.queued = false;
      if (!isActive()) return;
      await (model === 'acestep'
        ? Promise.all(STEM_KINDS.map((kind) => runAcestepStem(job, kind, src, outDir, isActive)))
        : runDemucs(job, src, outDir, isActive));
    }, () => void discardScratchSplit(jobId));
  } catch (err) {
    await discardScratchSplit(jobId);
    throw err;
  }
  return job;
}

/** Discard a scratch job and its temp files (RESET, the ABORT pill, or idle eviction);
 * nothing here is ever added to the library. */
export async function discardScratchSplit(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  jobs.delete(jobId);
  cancelQueued(jobId);
  await fs.rm(job?.outDir ?? path.join(os.tmpdir(), `mulakai-split-${jobId}`), { recursive: true, force: true });
}

/** Discard every settled scratch split unread for SCRATCH_IDLE_TTL_MS. A running one is left
 * to settle: it holds the queue's slot until its last stem lands. */
export async function evictIdleScratchSplits(now = Date.now()): Promise<void> {
  const idle = [...jobs.values()].filter((j) => j.stems.every((s) => s.status !== 'running')
    && now - j.lastSeenAt > SCRATCH_IDLE_TTL_MS);
  await Promise.all(idle.map((j) => discardScratchSplit(j.id)));
}
