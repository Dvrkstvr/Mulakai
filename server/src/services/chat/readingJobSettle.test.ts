/** The reading job's final settle (C3 review 2 and 4): a throwing settle never leaves the thread BUSY nor
 * drops the finished reading; a CANCEL during the settle wins (no save, no follow-up turn). */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-reading-settle-'));
process.env.LLM_API_URL = '';

const { getJob } = await import('../jobRegistry.js');
const { getRunning } = await import('../genQueue.js');
const { yue2Engine } = await import('../engines/yue2.js');
const { draftThread, resetDraftThread } = await import('./threadStore.js');
const store = await import('./referenceStore.js');
const { startReading, cancelReading, readingDeps, readingOf } = await import('./readingJob.js');
type ReadingDeps = import('./readingJob.js').ReadingDeps;
type StepDeps = import('./readingSteps.js').StepDeps;

const FACTS = {
  header: { meter: '4/4', unit: '1/32', bpm: 96, key: 'C', bars: 1, seconds: 2.5, units_per_quarter: 8 },
  key_notes: '', sections: [{ index: 0, label: 'verse', from_bar: 0, to_bar: 0 }], lyric_blocks: [], bar_map: [],
};
const steps: StepDeps = {
  lyrics: async () => ({ language: 'de', segments: [{ text: 'Hey du', start: 0, end: 1, words: [] }] }),
  transcribe: async () => ({ score: 'X:1\nK:C\nC|', warnings: [] }) as unknown as Awaited<ReturnType<StepDeps['transcribe']>>,
  readScore: async () => ({ ok: true, error: null, messages: [], chordsPresent: true, bpm: 96, seconds: 2.5, tokens: 40, facts: FACTS }),
  measure: async () => ({ budget: 6000, header: 20, sections: [{ name: 'verse', tokens: 20 }] }),
  analyze: async () => ({ caption: 'synthpop', lyrics: '', bpm: 96, key_scale: 'C major', time_signature: '4' }),
};
const deps = (settle: ReadingDeps['settle']): ReadingDeps => readingDeps({
  engine: { ...yue2Engine, url: 'http://127.0.0.1:1' }, steps, settle,
  services: async () => ({ lyrics: true, yue: true, acestep: true }), guard: async () => null,
});

function setup() {
  const thread = draftThread();
  const data = Buffer.alloc(16044);
  data.write('RIFF', 0); data.writeUInt32LE(16036, 4); data.write('WAVE', 8); data.write('fmt ', 12); data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(8000, 24); data.writeUInt32LE(16000, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(16000, 40);
  const res = store.fromUpload(thread.id, { data, filename: `take-${Math.random()}.wav` });
  if (!res.ok) throw new Error(res.reason);
  return { thread, ref: res.reference };
}
const settled = async (jobId: string) => {
  await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(jobId)?.status), { timeout: 3000 });
  await vi.waitFor(() => expect(getRunning()).toBeNull());
};

beforeEach(() => resetDraftThread());

describe('the reading job settle', () => {
  it('a throwing settle still frees the thread and keeps the finished reading; no follow-up', async () => {
    const { thread, ref } = setup();
    const onRead = vi.fn();
    const job = startReading(ref.id, { threadId: thread.id, onRead }, deps(async () => { throw new Error('qwen3:14b is still loaded'); }));
    await settled(job.id);
    expect(readingOf(job.id)).toBeUndefined();
    expect(cancelReading(job.id)).toBe(false);
    expect(store.getReference(ref.id)!.reading).not.toBeNull();
    expect(getJob(job.id)).toMatchObject({ status: 'failed', error: 'qwen3:14b is still loaded' });
    expect(onRead).not.toHaveBeenCalled();
  });

  it('a CANCEL during the final settle wins: nothing saved, no follow-up', async () => {
    const { thread, ref } = setup();
    const onRead = vi.fn();
    let id = '';
    const job = startReading(ref.id, { threadId: thread.id, onRead }, deps(async () => { expect(cancelReading(id)).toBe(true); }));
    id = job.id;
    await settled(job.id);
    expect(getJob(job.id)?.status).toBe('failed');
    expect(store.getReference(ref.id)!.reading).toBeNull();
    expect(onRead).not.toHaveBeenCalled();
    expect(readingOf(job.id)).toBeUndefined();
  });
});
