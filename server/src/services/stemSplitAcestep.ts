/** ACE-Step `extract` runner for the SPLIT feature: one generation call per stem
 * (docs/ace-step-1.5/GUIDE.md#Task Types), polled until it settles. */
import path from 'node:path';
import { config } from '../config.js';
import { releaseTask, queryResult, downloadAudio, type ReleaseTaskParams } from './acestep.js';
import { outputExt, MASTER_AUDIO_FORMAT, type OutputSettings } from './audioOutput.js';
import { transcodeBuffer } from './transcode.js';
import { ensureModelLoaded } from './jobs.js';
import { resolveInferenceSteps } from './inferenceSteps.js';
import { INSTRUCTIONS, type StemJobLike, type StemKind, type StemResult, type SourceAudio } from './stemSplitTypes.js';

/** Run one ACE-Step `extract` call for a single stem, writing its result into `outDir`.
 * `isActive` reports whether the owning job was cancelled/discarded — shared between the
 * layer-based split in stemSplit.ts and scratchSplitJobs.ts's upload-based variant, each with their own
 * job registry, so cancellation checks can't be a hardcoded module-private lookup here. */
export async function runAcestepStem(
  job: StemJobLike, kind: StemKind, src: SourceAudio, outDir: string, isActive: () => boolean,
): Promise<void> {
  const stem = job.stems.find((s) => s.kind === kind);
  if (!stem) return;
  try {
    const params: ReleaseTaskParams = {
      audio_format: MASTER_AUDIO_FORMAT,
      task_type: 'extract',
      instruction: INSTRUCTIONS[kind],
      use_random_seed: true,
    };
    await ensureModelLoaded(params);
    await resolveInferenceSteps(params);
    const { task_id } = await releaseTask(params, { srcAudio: src });
    await pollStem(job.id, stem, task_id, outDir, isActive, job.output);
  } catch (err) {
    if (!isActive()) return; // cancelled
    stem.status = 'failed';
    stem.error = err instanceof Error ? err.message : String(err);
  }
}

async function pollStem(
  jobId: string, stem: StemResult, taskId: string, outDir: string, isActive: () => boolean, out: OutputSettings,
): Promise<void> {
  for (;;) {
    await new Promise((r) => setTimeout(r, config.pollIntervalMs));
    if (!isActive()) return; // cancelled while waiting
    const [row] = await queryResult([taskId]);
    if (!row || row.status === 0) continue;
    if (row.status === 2) {
      stem.status = 'failed';
      stem.error = 'extraction failed';
      return;
    }
    const result = row.result.find((r) => r.status === 1) ?? row.result[0];
    if (!result?.file) {
      stem.status = 'failed';
      stem.error = 'no audio in result';
      return;
    }
    const audio = await downloadAudio(result.file);
    const filename = `${jobId}-${stem.kind}.${outputExt(out)}`;
    await transcodeBuffer(audio, path.join(outDir, filename), out);
    if (!isActive()) return; // cancelled while downloading
    stem.audioFile = filename;
    stem.status = 'done';
    return;
  }
}
