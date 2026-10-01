/**
 * Per-stem separation runners, shared by the layer-bound split (stemSplit.ts) and
 * the upload-based scratch split (scratchSplitJobs.ts). Two backends:
 * - ACE-Step's `extract` task isolates one track per call (docs/ace-step-1.5/
 *   GUIDE.md#Task Types), so getting all 4 stems fans out 4 concurrent
 *   generation jobs, each settling independently.
 * - Demucs runs as a separate HTTP microservice (like ACESTEP_API_URL); uvr-server
 *   is a drop-in behind the same DEMUCS_API_URL and contract.
 *
 * Every write gets a fresh filename: a claimed stem's version row points at its
 * file, so no later run may ever write to that path (PLAN.md "RE-EXTRACT Never
 * Touches a Claimed Stem").
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { releaseTask, queryResult, downloadAudio, type ReleaseTaskParams } from './acestep.js';
import { outputExt, MASTER_AUDIO_FORMAT, type OutputSettings } from './audioOutput.js';
import { transcodeBuffer } from './transcode.js';
import { ensureModelLoaded } from './jobs.js';
import { resolveInferenceSteps } from './inferenceSteps.js';

export type StemKind = 'vocals' | 'drums' | 'bass' | 'other';
export type SplitModel = 'acestep' | 'demucs';

export const STEM_KINDS: StemKind[] = ['vocals', 'drums', 'bass', 'other'];

export interface StemResult {
  kind: StemKind;
  status: 'running' | 'done' | 'failed';
  audioFile?: string;
  error?: string;
  claimed?: 'replaced' | 'added';
}

/** Minimal shape the runners need — satisfied by both `SplitJob` (stemSplit.ts) and
 * `ScratchSplitJob` (scratchSplitJobs.ts), which has no layer/song to belong to. */
export interface StemJobLike {
  id: string;
  stems: StemResult[];
  /** Output format/rate/depth chosen when the job started — stems honour the
   * same Settings block as generation output. */
  output: OutputSettings;
}

export interface SourceAudio {
  data: Buffer;
  filename: string;
}

export const INSTRUCTIONS: Record<StemKind, string> = {
  vocals: 'Extract the vocals from this audio, isolating the vocal track.',
  drums: 'Extract the drums from this audio, isolating the drum track.',
  bass: 'Extract the bass from this audio, isolating the bass track.',
  other: 'Extract the remaining instrumental elements (excluding vocals, drums, and bass) from this audio.',
};

function stemFilename(jobId: string, kind: StemKind, out: OutputSettings): string {
  return `${jobId}-${kind}-${crypto.randomUUID().slice(0, 8)}.${outputExt(out)}`;
}

/** Transcode a stem master into `outDir` under a fresh name and mark the stem done —
 * unless the job was cancelled meanwhile, in which case the file is dropped again. */
async function landStem(
  job: StemJobLike, stem: StemResult, master: Buffer, outDir: string, isActive: () => boolean,
): Promise<void> {
  const filename = stemFilename(job.id, stem.kind, job.output);
  const filePath = path.join(outDir, filename);
  await transcodeBuffer(master, filePath, job.output);
  if (!isActive()) {
    await fs.rm(filePath, { force: true }).catch(() => {});
    return;
  }
  stem.audioFile = filename;
  stem.status = 'done';
}

/** Run one ACE-Step `extract` call for a single stem, writing its result into `outDir`.
 * `isActive` reports whether the owning job was cancelled/discarded — each caller keeps
 * its own job registry, so cancellation can't be a module-private lookup here. */
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
    await pollStem(job, stem, task_id, outDir, isActive);
  } catch (err) {
    if (!isActive()) return; // cancelled
    stem.status = 'failed';
    stem.error = err instanceof Error ? err.message : String(err);
  }
}

async function pollStem(
  job: StemJobLike, stem: StemResult, taskId: string, outDir: string, isActive: () => boolean,
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
    await landStem(job, stem, await downloadAudio(result.file), outDir, isActive);
    return;
  }
}

/**
 * Demucs contract: POST the source audio, expect `{ stems: { vocals, drums, bass, other } }`
 * of downloadable URLs. One pass — all 4 stems settle together, no partial progress.
 * `kinds` limits which stems' results are kept (a RE-EXTRACT asks for one; the service
 * has no single-stem endpoint, so the other three are simply ignored).
 */
export async function runDemucs(
  job: StemJobLike, src: SourceAudio, outDir: string, isActive: () => boolean, kinds: StemKind[] = STEM_KINDS,
): Promise<void> {
  const stems = job.stems.filter((s) => kinds.includes(s.kind));
  try {
    if (!config.demucsUrl) throw new Error('Demucs is not configured (DEMUCS_API_URL unset)');
    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(src.data)]), src.filename);
    const res = await fetch(`${config.demucsUrl}/split`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Demucs split -> HTTP ${res.status}`);
    const json = (await res.json()) as { stems: Record<StemKind, string> };
    if (!isActive()) return;
    await Promise.all(
      stems.map(async (stem) => {
        try {
          const url = json.stems[stem.kind];
          if (!url) throw new Error(`missing ${stem.kind} stem in Demucs response`);
          const audioRes = await fetch(url);
          if (!audioRes.ok) throw new Error(`Demucs stem download -> HTTP ${audioRes.status}`);
          // demucs-server/uvr-server hand back a lossless float WAV master; the user's
          // container/rate/depth is applied in landStem, same as every other path.
          await landStem(job, stem, Buffer.from(await audioRes.arrayBuffer()), outDir, isActive);
        } catch (err) {
          stem.status = 'failed';
          stem.error = err instanceof Error ? err.message : String(err);
        }
      }),
    );
  } catch (err) {
    if (!isActive()) return;
    const msg = err instanceof Error ? err.message : String(err);
    for (const stem of stems) {
      stem.status = 'failed';
      stem.error = msg;
    }
  }
}
