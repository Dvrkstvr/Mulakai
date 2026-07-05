/**
 * Stem separation orchestration for the SPLIT feature. Two backends:
 * - ACE-Step's `extract` task isolates one track per call (docs/ace-step-1.5/
 *   GUIDE.md#Task Types), so getting all 4 stems fans out 4 concurrent
 *   generation jobs, each settling independently.
 * - Demucs runs as a separate HTTP microservice (like ACESTEP_API_URL). Its
 *   request/response contract below is provisional pending the real repo.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { releaseTask, queryResult, downloadAudio, type ReleaseTaskParams } from './acestep.js';
import { ensureModelLoaded } from './jobs.js';

export type StemKind = 'vocals' | 'drums' | 'bass' | 'other';
export type SplitModel = 'acestep' | 'demucs';

export interface StemResult {
  kind: StemKind;
  status: 'running' | 'done' | 'failed';
  audioFile?: string;
  error?: string;
  claimed?: 'replaced' | 'added';
}

export interface SplitJob {
  id: string;
  layerId: string;
  songId: string;
  model: SplitModel;
  stems: StemResult[];
  createdAt: number;
}

const jobs = new Map<string, SplitJob>();

const STEM_KINDS: StemKind[] = ['vocals', 'drums', 'bass', 'other'];

const INSTRUCTIONS: Record<StemKind, string> = {
  vocals: 'Extract the vocals from this audio, isolating the vocal track.',
  drums: 'Extract the drums from this audio, isolating the drum track.',
  bass: 'Extract the bass from this audio, isolating the bass track.',
  other: 'Extract the remaining instrumental elements (excluding vocals, drums, and bass) from this audio.',
};

export function getSplitJob(id: string): SplitJob | undefined {
  return jobs.get(id);
}

interface SourceAudio {
  data: Buffer;
  filename: string;
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
export async function startSplit(layerId: string, model: SplitModel): Promise<SplitJob> {
  const src = await loadSourceAudio(layerId);
  const job: SplitJob = {
    id: crypto.randomUUID(),
    layerId,
    songId: src.songId,
    model,
    stems: STEM_KINDS.map((kind) => ({ kind, status: 'running' })),
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);

  if (model === 'acestep') {
    for (const kind of STEM_KINDS) void runAcestepStem(job, kind, src);
  } else {
    void runDemucs(job, src);
  }
  return job;
}

async function runAcestepStem(job: SplitJob, kind: StemKind, src: SourceAudio): Promise<void> {
  const stem = job.stems.find((s) => s.kind === kind);
  if (!stem) return;
  try {
    const params: ReleaseTaskParams = {
      audio_format: 'mp3',
      task_type: 'extract',
      instruction: INSTRUCTIONS[kind],
      use_random_seed: true,
    };
    await ensureModelLoaded(params);
    const { task_id } = await releaseTask(params, { srcAudio: src });
    await pollStem(job.id, stem, task_id);
  } catch (err) {
    if (!jobs.has(job.id)) return; // cancelled
    stem.status = 'failed';
    stem.error = err instanceof Error ? err.message : String(err);
  }
}

async function pollStem(jobId: string, stem: StemResult, taskId: string): Promise<void> {
  for (;;) {
    await new Promise((r) => setTimeout(r, config.pollIntervalMs));
    if (!jobs.has(jobId)) return; // cancelled while waiting
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
    const filename = `${jobId}-${stem.kind}.mp3`;
    await fs.writeFile(path.join(config.audioDir, filename), audio);
    if (!jobs.has(jobId)) return; // cancelled while downloading
    stem.audioFile = filename;
    stem.status = 'done';
    return;
  }
}

/**
 * Provisional Demucs contract: POST the source audio, expect
 * `{ stems: { vocals, drums, bass, other } }` of downloadable URLs. One
 * deterministic pass — all 4 stems settle together, no partial progress.
 */
async function runDemucs(job: SplitJob, src: SourceAudio): Promise<void> {
  try {
    if (!config.demucsUrl) throw new Error('Demucs is not configured (DEMUCS_API_URL unset)');
    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(src.data)]), src.filename);
    const res = await fetch(`${config.demucsUrl}/split`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Demucs split -> HTTP ${res.status}`);
    const json = (await res.json()) as { stems: Record<StemKind, string> };
    if (!jobs.has(job.id)) return;
    await Promise.all(
      STEM_KINDS.map(async (kind) => {
        const stem = job.stems.find((s) => s.kind === kind);
        if (!stem) return;
        try {
          const url = json.stems[kind];
          if (!url) throw new Error(`missing ${kind} stem in Demucs response`);
          const audioRes = await fetch(url);
          if (!audioRes.ok) throw new Error(`Demucs stem download -> HTTP ${audioRes.status}`);
          const audio = Buffer.from(await audioRes.arrayBuffer());
          // demucs-server encodes stems as mp3 (see its main.py) — same extension as ACE-Step's output.
          const filename = `${job.id}-${kind}.mp3`;
          await fs.writeFile(path.join(config.audioDir, filename), audio);
          if (!jobs.has(job.id)) return;
          stem.audioFile = filename;
          stem.status = 'done';
        } catch (err) {
          stem.status = 'failed';
          stem.error = err instanceof Error ? err.message : String(err);
        }
      }),
    );
  } catch (err) {
    if (!jobs.has(job.id)) return;
    const msg = err instanceof Error ? err.message : String(err);
    for (const stem of job.stems) {
      stem.status = 'failed';
      stem.error = msg;
    }
  }
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
  stem.status = 'running';
  stem.error = undefined;
  void loadSourceAudio(job.layerId)
    .then((src) => (job.model === 'acestep' ? runAcestepStem(job, kind, src) : runDemucs(job, src)))
    .catch((err) => {
      stem.status = 'failed';
      stem.error = err instanceof Error ? err.message : String(err);
    });
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
