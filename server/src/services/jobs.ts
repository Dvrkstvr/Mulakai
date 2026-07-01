/** In-memory job orchestrator: release_task -> poll -> download -> persist song/layer/version. */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { releaseTask, queryResult, downloadAudio, type ReleaseTaskParams } from './acestep.js';

export interface Job {
  id: string;
  taskId: string;
  status: 'running' | 'done' | 'failed';
  error?: string;
  songId?: string;
  createdAt: number;
}

const jobs = new Map<string, Job>();

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

/** Submit a text2music generation and persist the result as a new song with a base layer. */
export async function startGeneration(params: ReleaseTaskParams, title: string): Promise<Job> {
  const { task_id } = await releaseTask({ audio_format: 'mp3', ...params, task_type: 'text2music' });
  const job: Job = { id: crypto.randomUUID(), taskId: task_id, status: 'running', createdAt: Date.now() };
  jobs.set(job.id, job);
  void poll(job, params, title);
  return job;
}

async function poll(job: Job, params: ReleaseTaskParams, title: string): Promise<void> {
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
      job.songId = await persistSong(result.file, params, result, title);
      job.status = 'done';
      return;
    } catch (err) {
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : String(err);
      return;
    }
  }
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
