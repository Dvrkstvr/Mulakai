/**
 * RE-EXTRACT on an open SPLIT session (stemSplit.ts): re-run one stem, or every unclaimed one (SPLIT ALL AGAIN),
 * from the split's original source as one queue job. ACE-Step runs a fresh-seed extract per stem; Demucs has no
 * single-stem endpoint, so one full pass keeps only the asked stems' output. New audio lands under new filenames; the
 * superseded ones (never claimed) are deleted once replaced.
 */
import crypto from 'node:crypto';
import { config } from '../config.js';
import { enqueue } from './genQueue.js';
import { layerName } from './queueGuards.js';
import { discardUnclaimedFile, failRunning } from './stemFiles.js';
import { runAcestepStem, runDemucs, type StemKind, type StemResult } from './stemRunners.js';
import { getSplitJob, isLiveSplit, readSource } from './stemSplit.js';

/** Queue a re-run of `kinds`. Rejected when a stem is claimed or still running, or when there is none. */
export function reextractStems(jobId: string, kinds: StemKind[]): StemResult[] {
  const job = getSplitJob(jobId);
  if (!job) throw new Error('unknown split job');
  const stems = kinds.map((kind) => {
    const stem = job.stems.find((s) => s.kind === kind);
    if (!stem) throw new Error('unknown stem');
    if (stem.claimed) throw new Error('stem already claimed');
    if (stem.status === 'running') throw new Error('stem is still running');
    return stem;
  });
  if (stems.length === 0) throw new Error('no stems to re-extract');
  const previous = stems.map((s) => s.audioFile);
  const prior = stems.map((s) => ({ status: s.status, error: s.error }));
  const restore = () => stems.forEach((s, i) => Object.assign(s, prior[i])); // back to their last results
  // ABORT on a running re-extract drops only these stems' new takes; the session stays open.
  let aborted = false;
  const isActive = () => isLiveSplit(job.id) && !aborted;
  const label = kinds.length === 1 ? `re-extract ${kinds[0]}` : `re-extract ${kinds.length} stems`;
  const info = { kind: 'split' as const, jobId: crypto.randomUUID(), songId: job.songId, layer: layerName(job.layerId), label };
  for (const stem of stems) {
    stem.status = 'running';
    stem.error = undefined;
  }
  try {
    enqueue(info, () => {
      if (!isActive()) return undefined;
      return readSource(job.sourceFile)
        .then(async (src) => {
          if (job.model === 'demucs') return runDemucs(job, src, config.audioDir, isActive, kinds);
          await Promise.all(kinds.map((kind) => runAcestepStem(job, kind, src, config.audioDir, isActive)));
        })
        .then(async () => {
          await Promise.all(stems.map((s, i) => (s.audioFile !== previous[i] ? discardUnclaimedFile(previous[i]) : undefined)));
        })
        .catch((err) => failRunning(stems, err));
    }, (reason) => failRunning(stems, new Error(reason)), () => {
      aborted = true;
      restore();
    });
  } catch (err) {
    restore(); // the queue was full: the stems keep their last results
    throw err;
  }
  return stems;
}

export function reextractStem(jobId: string, kind: StemKind): StemResult {
  return reextractStems(jobId, [kind])[0];
}

/** SPLIT ALL AGAIN: every stem not claimed and not running. */
export function reextractAll(jobId: string): StemResult[] {
  const job = getSplitJob(jobId);
  if (!job) throw new Error('unknown split job');
  return reextractStems(jobId, job.stems.filter((s) => !s.claimed && s.status !== 'running').map((s) => s.kind));
}
