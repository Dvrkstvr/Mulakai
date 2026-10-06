/** CANCEL a reading over the chat cancel route (C3): a running reading is aborted, reads CANCELLED, saves nothing. */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chat-reading-cancel-'));
process.env.LLM_API_URL = '';

const { getJob } = await import('../services/jobRegistry.js');
const { getRunning, resetQueue } = await import('../services/genQueue.js');
const { draftThread } = await import('../services/chat/threadStore.js');
const { makeChatTurnsRouter } = await import('./chatTurns.js');

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/chat', makeChatTurnsRouter());
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', () => r()));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/chat`;
});
afterAll(async () => { resetQueue(); await new Promise<void>((r) => server.close(() => r())); });

const post = async (p: string, body: unknown = {}) => {
  const res = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};

describe('CANCEL a reading (C3)', () => {
  it('a running reading is aborted and reads cancelled; it stops before its next step and saves nothing', async () => {
    const { startReading, readingDeps } = await import('../services/chat/readingJob.js');
    const store = await import('../services/chat/referenceStore.js');
    const { appendMessage, updateMessage } = await import('../services/chat/messageStore.js');
    const thread = draftThread();
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + 16000, 4); h.write('WAVE', 8); h.write('fmt ', 12);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(8000, 24);
    h.writeUInt32LE(16000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(16000, 40);
    const added = store.fromUpload(thread.id, { data: Buffer.concat([h, Buffer.alloc(16000)]), filename: 'cancel.wav' });
    if (!added.ok) throw new Error(added.reason);
    let release!: () => void;
    const job = startReading(added.reference.id, { threadId: thread.id }, readingDeps({
      guard: () => new Promise((r) => { release = () => r(null); }),
      services: async () => ({ lyrics: false, yue: false, acestep: false }), settle: async () => undefined,
    }));
    const { message } = appendMessage(thread.id, { role: 'assistant', kind: 'reading', text: 'x', body: { referenceId: added.reference.id, name: 'cancel.wav', followUp: false, reading: null } });
    updateMessage(message.id, { jobId: job.id });
    await vi.waitFor(() => expect(getRunning()?.jobId).toBe(job.id));
    expect((await post(`/jobs/${job.id}/cancel`)).body).toEqual({ ok: true, aborted: true });
    expect(getJob(job.id)).toMatchObject({ status: 'failed', cancelled: true });
    release();
    await vi.waitFor(() => expect(getRunning()).toBeNull());
    expect(store.getReference(added.reference.id)?.reading).toBeNull();
  });
});
