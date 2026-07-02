/** In-memory job orchestrator: release_task -> poll -> download -> persist song/layer/version. */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { releaseTask, queryResult, downloadAudio, initModel, type ReleaseTaskParams, type TaskResult } from './acestep.js';

export interface Job {
  id: string;
  taskId: string;
  status: 'loading' | 'running' | 'done' | 'failed';
  error?: string;
  songId?: string;
  createdAt: number;
}

const jobs = new Map<string, Job>();

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

/**
 * Load the requested model into slot 1 if a specific one was chosen.
 * AUTO (no model / no LM selected) skips init and lets ACE-Step lazy-load its
 * own defaults.
 */
async function ensureModelLoaded(params: ReleaseTaskParams): Promise<void> {
  const lmSelected = !!params.lm_model_path;
  const needLlm = !!params.thinking || !!params.use_format || lmSelected;
  if (params.model || lmSelected) {
    await initModel({ model: params.model, lmModel: params.lm_model_path, initLlm: needLlm });
  }
}

/** Submit a text2music generation and persist the result as a new song with a base layer. */
export function startGeneration(params: ReleaseTaskParams, title: string): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'loading', createdAt: Date.now() };
  jobs.set(job.id, job);
  void run(job, async () => {
    await ensureModelLoaded(params);
    job.status = 'running';
    const { task_id } = await releaseTask({ audio_format: 'mp3', ...params, task_type: 'text2music' });
    job.taskId = task_id;
    await poll(job, (result) => persistSong(result.file, params, result, title));
  });
  return job;
}

/** Wrap an async job body so any thrown error marks the job failed. */
async function run(job: Job, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : String(err);
  }
}

/** Repaint a region of a layer's active version; result becomes the layer's new active version. */
export async function startRepaint(layerId: string, params: ReleaseTaskParams): Promise<Job> {
  const row = db
    .prepare(
      `SELECT v.audio_file, l.song_id FROM versions v
       JOIN layers l ON v.layer_id = l.id
       WHERE l.id = ? AND v.active = 1`,
    )
    .get(layerId) as { audio_file: string; song_id: string } | undefined;
  if (!row) throw new Error('unknown layer');

  const srcAudio = await fs.readFile(path.join(config.audioDir, row.audio_file));
  const fullParams: ReleaseTaskParams = { audio_format: 'mp3', ...params, task_type: 'repaint' };
  const { task_id } = await releaseTask(fullParams, { data: srcAudio, filename: row.audio_file });

  const job: Job = {
    id: crypto.randomUUID(), taskId: task_id, status: 'running',
    songId: row.song_id, createdAt: Date.now(),
  };
  jobs.set(job.id, job);
  const label = `repaint ${fmtTime(params.repainting_start ?? 0)}–${
    params.repainting_end && params.repainting_end > 0 ? fmtTime(params.repainting_end) : 'end'}`;
  void poll(job, (result) => persistVersion(layerId, result.file, fullParams, result, label));
  return job;
}

function fmtTime(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

async function poll(job: Job, onSuccess: (result: TaskResult) => Promise<string>): Promise<void> {
  for (;;) {
    await new Promise((r) => setTimeout(r, config.pollIntervalMs));
    try {
      const [row] = await queryResult([job.taskId]);
      if (!row || row.status === 0) continue;
      if (row.status === 2) {
        job.status = 'failed';
        job.error = 'generation failed';
        return;
      }
      const result = row.result.find((r) => r.status === 1) ?? row.result[0];
      if (!result?.file) {
        job.status = 'failed';
        job.error = 'no audio in result';
        return;
      }
      job.songId = await onSuccess(result);
      job.status = 'done';
      return;
    } catch (err) {
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : String(err);
      return;
    }
  }
}

/** Store a repaint result as the layer's new active version. Returns the song id. */
async function persistVersion(
  layerId: string,
  fileUrl: string,
  params: ReleaseTaskParams,
  result: TaskResult,
  label: string,
): Promise<string> {
  const audio = await downloadAudio(fileUrl);
  const versionId = crypto.randomUUID();
  const filename = `${versionId}.mp3`;
  await fs.writeFile(path.join(config.audioDir, filename), audio);

  db.prepare(`UPDATE versions SET active = 0 WHERE layer_id = ?`).run(layerId);
  db.prepare(
    `INSERT INTO versions (id, layer_id, audio_file, label, params_json, seed)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(versionId, layerId, filename, label, JSON.stringify(params), result.seed_value);

  const row = db.prepare(`SELECT song_id FROM layers WHERE id = ?`).get(layerId) as { song_id: string };
  return row.song_id;
}

async function persistSong(
  fileUrl: string,
  params: ReleaseTaskParams,
  result: { metas: { bpm?: number; duration?: number; keyscale?: string; timesignature?: string }; seed_value: string; prompt: string; lyrics: string },
  title: string,
): Promise<string> {
  const audio = await downloadAudio(fileUrl);
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const filename = `${versionId}.mp3`;
  await fs.writeFile(path.join(config.audioDir, filename), audio);

  db.prepare(
    `INSERT INTO songs (id, title, caption, lyrics, bpm, key_scale, time_signature, duration)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    songId, title, result.prompt, result.lyrics,
    result.metas.bpm ?? null, result.metas.keyscale ?? '',
    result.metas.timesignature ?? '', result.metas.duration ?? null,
  );
  db.prepare(
    `INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`,
  ).run(layerId, songId);
  db.prepare(
    `INSERT INTO versions (id, layer_id, audio_file, label, params_json, seed)
     VALUES (?, ?, ?, 'first generation', ?, ?)`,
  ).run(versionId, layerId, filename, JSON.stringify(params), result.seed_value);

  return songId;
}
