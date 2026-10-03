/** GET /queue, POST /:jobId/cancel and a queued job's poll (PLAN.md "UI Redesign", S4.4), plus
 * the song trash route cancelling queued work (S4.5). The real queue and job registry. */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-queue-route-test-'));

const { db } = await import('../db/index.js');
const { registerJob, queueJob } = await import('../services/jobs.js');
const { enqueue, resetQueue } = await import('../services/genQueue.js');
const { generateStatusRouter } = await import('./generateStatus.js');
const { songsRouter } = await import('./songs.js');

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/generate', generateStatusRouter);
  app.use('/api/songs', songsRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
afterEach(() => resetQueue());

const getJson = async (p: string) => (await fetch(`${base}${p}`)).json();
const post = (p: string, body?: unknown) => fetch(`${base}${p}`, {
  method: p.endsWith('/trash') ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}),
});

/** A job whose body runs until `free` is called. */
function job(info: Parameters<typeof queueJob>[0]) {
  let free!: () => void;
  const j = queueJob(info, { id: crypto.randomUUID(), taskId: '', status: 'queued', createdAt: Date.now() },
    () => new Promise<void>((r) => { free = r; }), 'running');
  return { job: j, free: () => free() };
}

function seedSong(title: string): string {
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title) VALUES (?, ?)`).run(id, title);
  return id;
}

describe('the queue routes', () => {
  it('lists the running job and the queued ones, titled from the song when the entry has none', async () => {
    const songId = seedSong('Copper Sky');
    const running = job({ kind: 'generate', title: 'Static Bloom', task: 'text2music' });
    const queued = job({ kind: 'repaint', songId, layer: 'Vocals', label: 'repaint 1:32–2:07' });

    const body = await getJson('/generate/queue');
    expect(body.running).toMatchObject({ kind: 'generate', jobId: running.job.id, title: 'Static Bloom', task: 'text2music' });
    expect(typeof body.running.startedAt).toBe('number');
    expect(body.queued).toEqual([expect.objectContaining({
      kind: 'repaint', jobId: queued.job.id, songId, title: 'Copper Sky', layer: 'Vocals', label: 'repaint 1:32–2:07', position: 1,
    })]);
    expect(typeof body.queued[0].queuedAt).toBe('number');
    expect(await getJson(`/generate/${queued.job.id}`)).toMatchObject({ status: 'queued', queuePosition: 1 });
  });

  it('cancels a queued job: it leaves the line and settles failed, cancelled', async () => {
    job({ kind: 'generate' });
    const queued = job({ kind: 'repaint' });
    const res = await post(`/generate/${queued.job.id}/cancel`);
    expect(await res.json()).toEqual({ ok: true, cancelled: true });
    expect((await getJson('/generate/queue')).queued).toEqual([]);
    expect(await getJson(`/generate/${queued.job.id}`)).toMatchObject({ status: 'failed', error: 'cancelled', cancelled: true });
  });

  it("cancelling the running job is ABORT: it fails and the next one starts", async () => {
    const running = job({ kind: 'generate' });
    const next = job({ kind: 'remaster' });
    expect(await (await post(`/generate/${running.job.id}/cancel`)).json()).toEqual({ ok: true, aborted: true });
    expect(await getJson(`/generate/${running.job.id}`)).toMatchObject({ status: 'failed', error: 'Aborted' });
    await vi.waitFor(async () => expect((await getJson('/generate/queue')).running?.jobId).toBe(next.job.id));
    expect((await getJson(`/generate/${next.job.id}`)).status).toBe('running');
  });

  it('404s a cancel for a job that is neither queued nor running', async () => {
    registerJob({ id: 'settled', taskId: '', status: 'done', createdAt: Date.now() });
    expect((await post('/generate/settled/cancel')).status).toBe(404);
  });

  it('404s a job the server no longer has, as after a restart', async () => {
    const res = await fetch(`${base}/generate/lost-in-a-restart`);
    expect(res.status).toBe(404);
  });

  it('trashing a song cancels its queued jobs; restoring cancels nothing', async () => {
    const songId = seedSong('Glass Orchard');
    const other = seedSong('Other');
    enqueue({ kind: 'generate', jobId: 'holder' }, () => new Promise(() => {}));
    const mine = job({ kind: 'repaint', songId });
    const theirs = job({ kind: 'repaint', songId: other });

    expect((await post(`/songs/${songId}/trash`)).status).toBe(200);
    expect(await getJson(`/generate/${mine.job.id}`)).toMatchObject({
      status: 'failed', error: 'the song was moved to trash', cancelled: true,
    });
    expect((await getJson('/generate/queue')).queued.map((q: { jobId: string }) => q.jobId)).toEqual([theirs.job.id]);
    await post(`/songs/${other}/trash`, { restore: true });
    expect((await getJson('/generate/queue')).queued).toHaveLength(1);
  });
});
