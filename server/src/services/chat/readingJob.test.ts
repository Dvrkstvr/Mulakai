/** The reading job against fakeYue's recorded transcriptions (CR-0): done, partial, cancelled,
 * an unreadable file, a cut, the GPU guard, and the hand-off order (F-061, D-126, R-028). */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startFakeYue, transcriptionContract, type FakeYue } from '../../../test-fakes/fakeYue.js';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-reading-job-'));
process.env.POLL_INTERVAL_MS = '5';
process.env.LLM_API_URL = '';

const { config } = await import('../../config.js');
const { db } = await import('../../db/index.js');
const { getJob } = await import('../jobRegistry.js');
const { getRunning } = await import('../genQueue.js');
const { yue2Engine } = await import('../engines/yue2.js');
const { draftThread, resetDraftThread } = await import('./threadStore.js');
const { appendMessage, messageById } = await import('./messageStore.js');
const store = await import('./referenceStore.js');
const { startReading, cancelReading, readingDeps } = await import('./readingJob.js');
type ReadingDeps = import('./readingJob.js').ReadingDeps;
type ReadingBody = import('./chatTypes.js').ReadingBody;

function wav(seconds = 1): Buffer {
  const data = Buffer.alloc(16000 * seconds);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(8000, 24); h.writeUInt32LE(16000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const FACTS = {
  header: { meter: '4/4', unit: '1/32', bpm: 96, key: 'C', bars: 1, seconds: 2.5, units_per_quarter: 8 },
  key_notes: '', sections: [{ index: 0, label: 'verse', from_bar: 0, to_bar: 0 }], lyric_blocks: [], bar_map: [],
};
let fake: FakeYue;
let seen: string[];
const tmpDir = () => path.join(config.dataDir, 'tmp');

function deps(over: Partial<ReadingDeps> = {}): ReadingDeps {
  const note = (job: () => string | undefined) => { const t = job(); if (t) seen.push(t); };
  return readingDeps({
    engine: { ...yue2Engine, url: fake.url },
    services: async () => ({ lyrics: true, yue: true, acestep: true }),
    guard: async () => null,
    settle: vi.fn(async () => undefined),
    steps: {
      lyrics: vi.fn(async () => { note(() => getRunning() ? getJob(getRunning()!.jobId)?.progressText : undefined); return { language: 'de', segments: [{ text: 'Hey du', start: 0, end: 1, words: [] }] }; }),
      readScore: vi.fn(async () => { note(() => getJob(getRunning()!.jobId)?.progressText); return { ok: true, error: null, messages: [], chordsPresent: true, bpm: 96, seconds: 2.5, tokens: 40, facts: FACTS }; }),
      measure: vi.fn(async () => ({ budget: 6000, header: 20, sections: [{ name: 'verse', tokens: 20 }] })),
      analyze: vi.fn(async () => { note(() => getJob(getRunning()!.jobId)?.progressText); return { caption: 'synthpop', lyrics: '', bpm: 96, key_scale: 'C major', time_signature: '4' }; }),
    },
    ...over,
  });
}

function setup(seconds = 2) {
  const thread = draftThread();
  const res = store.fromUpload(thread.id, { data: wav(seconds), filename: `take-${Math.random()}.wav` });
  if (!res.ok) throw new Error(res.reason);
  const { message } = appendMessage(thread.id, { role: 'assistant', kind: 'reading', text: '',
    body: { referenceId: res.reference.id, name: res.reference.name, followUp: true, reading: null } satisfies ReadingBody });
  return { thread, ref: res.reference, cardId: message.id };
}

const settled = async (jobId: string, status: 'done' | 'failed') => {
  await vi.waitFor(() => expect(getJob(jobId)?.status).toBe(status), { timeout: 3000 });
  await vi.waitFor(() => expect(getRunning()).toBeNull());
};

beforeAll(async () => { fake = await startFakeYue(); });
afterAll(async () => { await fake.close(); });
beforeEach(() => {
  resetDraftThread();
  fake.transcription = transcriptionContract('transcription-chords-done');
  fake.requests.length = 0;
  seen = [];
});

describe('startReading', () => {
  it('reads WORDS > SCORE > CAPTION in one transcribe slot, saves the Reading, snapshots the card, then onRead', async () => {
    const { thread, ref, cardId } = setup();
    const onRead = vi.fn();
    const d = deps();
    const job = startReading(ref.id, { threadId: thread.id, cardId, onRead }, d);
    expect(getRunning()).toMatchObject({ kind: 'transcribe', label: 'chat reading', jobId: job.id });
    await settled(job.id, 'done');

    const reading = store.getReference(ref.id)!.reading!;
    expect(reading).toMatchObject({ reading_v: 1, cut: false, plan: { words: 'service', score: 'service', caption: 'service' } });
    expect(reading.readTo).toBeCloseTo(2, 1);
    expect(reading.words).toEqual({ language: 'de', lines: ['Hey du'], instrumental: false });
    expect(reading.score).toMatchObject({ abc: fake.transcription.score, source: 'transcribed', chords: true, facts: FACTS, warnings: ['short clip'] });
    expect(reading.caption).toEqual({ caption: 'synthpop', bpm: 96, key: 'C major', meter: '4' });
    expect(fake.requests.find((r) => r.path === '/v1/transcriptions')?.body).toEqual({ form: { chords: 'true' } });
    expect((messageById(cardId)!.body as ReadingBody).reading).toEqual(reading);
    expect(onRead).toHaveBeenCalledWith(reading, expect.objectContaining({ id: ref.id }));
    expect(d.settle).toHaveBeenCalledTimes(1);
    expect(seen[0]).toMatch(/^WORDS/);
    expect(seen.some((t) => t.startsWith('SCORE'))).toBe(true);
    expect(seen.at(-1)).toMatch(/^CAPTION/);
  });

  it('a part failing alone leaves the others: a failed transcription and lyrics-server down', async () => {
    fake.transcription = transcriptionContract('transcription-chords-failed');
    const { thread, ref } = setup();
    const d = deps();
    d.steps.lyrics = vi.fn(async () => { throw new Error('lyrics-server transcribe -> fetch failed'); });
    const job = startReading(ref.id, { threadId: thread.id }, d);
    await settled(job.id, 'done');
    const reading = store.getReference(ref.id)!.reading!;
    expect(reading.words).toEqual({ notRead: 'lyrics-server transcribe -> fetch failed' });
    expect(reading.score).toEqual({ notRead: 'SheetSage2 built no score: no beats decoded' });
    expect(reading.caption).toMatchObject({ caption: 'synthpop' });
  });

  it('CANCEL during a running transcription stops yue-server, saves nothing and calls no follow-up', async () => {
    fake.transcription = transcriptionContract('transcription-hold');
    const { thread, ref } = setup();
    const onRead = vi.fn();
    const d = deps();
    const job = startReading(ref.id, { threadId: thread.id, onRead }, d);
    await vi.waitFor(() => expect(getJob(job.id)?.progressText).toMatch(/^SCORE · transcribing/));
    expect(cancelReading(job.id)).toBe(true);
    await settled(job.id, 'failed');
    expect(fake.requests.some((r) => r.path === '/v1/transcriptions/tr-0001/cancel')).toBe(true);
    expect(store.getReference(ref.id)!.reading).toBeNull();
    expect(onRead).not.toHaveBeenCalled();
    expect(d.settle).toHaveBeenCalled();
    expect(d.steps.analyze).not.toHaveBeenCalled();
  });

  it('a queued reading cancels out of the line', async () => {
    const { thread, ref } = setup();
    let free!: () => void;
    const { enqueue } = await import('../genQueue.js');
    enqueue({ kind: 'generate', jobId: 'blocker' }, () => new Promise<void>((r) => { free = r; }));
    const job = startReading(ref.id, { threadId: thread.id }, deps());
    expect(cancelReading(job.id)).toBe(true);
    expect(getJob(job.id)).toMatchObject({ status: 'failed', cancelled: true });
    expect(cancelReading(job.id)).toBe(false);
    free();
    await vi.waitFor(() => expect(getRunning()).toBeNull());
  });

  it('fails only when the file cannot be read at all, with the reason', async () => {
    const { thread, ref } = setup();
    fs.rmSync(path.join(config.audioDir, ref.file));
    const job = startReading(ref.id, { threadId: thread.id }, deps());
    await settled(job.id, 'failed');
    expect(getJob(job.id)?.error).toBe(`${ref.name} could not be read: the file is gone`);
    expect(store.getReference(ref.id)!.reading).toBeNull();
  });

  it('reads the first 360 s of a longer file through a temp trim, says so, and removes the temp', async () => {
    const { thread, ref } = setup();
    db.prepare(`UPDATE chat_references SET seconds = 400 WHERE id = ?`).run(ref.id);
    const trim = vi.fn(async (src: string, dst: string) => { fs.copyFileSync(src, dst); });
    const job = startReading(ref.id, { threadId: thread.id }, deps({ trim }));
    await settled(job.id, 'done');
    expect(trim).toHaveBeenCalledWith(path.join(config.audioDir, ref.file), expect.stringMatching(/\.flac$/), 360);
    expect(store.getReference(ref.id)!.reading).toMatchObject({ seconds: 400, readTo: 360, cut: true });
    expect(fs.readdirSync(tmpDir())).toEqual([]);
  });

  it('refuses at its turn while the planner is loaded, touching no service', async () => {
    const { thread, ref } = setup();
    const d = deps({ guard: async () => 'the planner model qwen3:14b is loaded' });
    const job = startReading(ref.id, { threadId: thread.id }, d);
    await settled(job.id, 'failed');
    expect(getJob(job.id)?.error).toBe('the planner model qwen3:14b is loaded');
    expect(d.steps.lyrics).not.toHaveBeenCalled();
    expect(fake.requests).toEqual([]);
  });

  it('confirms the planner is off the GPU before the slot is released and before the follow-up', async () => {
    const { thread, ref } = setup();
    const order: string[] = [];
    const d = deps({ settle: vi.fn(async () => { order.push(`settle:${getRunning() ? 'held' : 'free'}`); }) });
    const job = startReading(ref.id, { threadId: thread.id, onRead: () => order.push('onRead') }, d);
    await settled(job.id, 'done');
    expect(order).toEqual(['settle:held', 'onRead']);
  });
});
