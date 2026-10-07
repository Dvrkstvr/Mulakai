/** When an analysis is queued (F-052, D-172): the pure rule as a table, the facts from the library, the settle
 * subscription (a real queued job settling), and the thread GET's check. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-analysis-trigger-'));

const { db } = await import('../../db/index.js');
const { queueJob } = await import('../jobRunner.js');
const { emitJobSettled } = await import('../jobEvents.js');
const { getRunning, getQueued } = await import('../genQueue.js');
const { writeAnalysis } = await import('./analysisStore.js');
const { songThread } = await import('./threadStore.js');
const { shouldAnalyze, songFacts, ensureAnalysis, startAnalysisTrigger, AUDIO_KINDS } = await import('./analysisTrigger.js');
type SongFacts = import('./analysisTrigger.js').SongFacts;
type Job = import('../jobRegistry.js').Job;

const YES: SongFacts = { hasThread: true, playable: true, analyzed: false, pending: false };
const done = (kind: string) => ({ kind, status: 'done', songId: 's1' }) as Parameters<typeof shouldAnalyze>[0];

describe('shouldAnalyze', () => {
  it.each(AUDIO_KINDS)('a done %s on a chat song whose take is unread queues one', (kind) => {
    expect(shouldAnalyze(done(kind), YES)).toBe(true);
  });

  it.each([
    ['a failed save', { ...done('repaint')!, status: 'failed' }, YES],
    ['the analysis\'s own settle (transcribe)', done('transcribe'), YES],
    ['a turn (plan)', done('plan'), YES],
    ['word timings', done('timings'), YES],
    ['no song on the event', { kind: 'generate', status: 'done' }, YES],
    ['a song with no chat thread (Q-109)', done('generate'), { ...YES, hasThread: false }],
    ['no playable take', done('generate'), { ...YES, playable: false }],
    ['a take already read, or failed (RETRY reads it again)', done('repaint'), { ...YES, analyzed: true }],
    ['an analysis already waiting or reading it', done('repaint'), { ...YES, pending: true }],
  ] as const)('%s queues nothing', (_name, event, facts) => {
    expect(shouldAnalyze(event as Parameters<typeof shouldAnalyze>[0], facts)).toBe(false);
  });

  it('the thread GET (no event) uses the same facts', () => {
    expect(shouldAnalyze(null, YES)).toBe(true);
    expect(shouldAnalyze(null, { ...YES, analyzed: true })).toBe(false);
  });
});

function song(thread = true) {
  const songId = crypto.randomUUID();
  const layer = crypto.randomUUID();
  const v = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title) VALUES (?, 'S')`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layer, songId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, active) VALUES (?, ?, 'a.flac', 1)`).run(v, layer);
  if (thread) songThread(songId);
  return { songId, v };
}

describe('songFacts', () => {
  it('reads the thread, the playable take and its stored analysis', () => {
    const { songId, v } = song();
    expect(songFacts(songId)).toEqual(YES);
    writeAnalysis({ analysis_v: 1, versionId: v, failed: 'the audio file is missing', at: 't' });
    expect(songFacts(songId).analyzed).toBe(true);
    expect(songFacts(song(false).songId)).toEqual({ hasThread: false, playable: false, analyzed: false, pending: false });
  });
});

describe('the trigger', () => {
  let stop = () => {};
  afterEach(() => stop());

  it('a save that settles done queues the analysis behind whatever waits (FIFO)', async () => {
    const { songId } = song();
    const start = vi.fn((_id: string) => ({ id: 'analysis' }) as Job);
    stop = startAnalysisTrigger({ facts: songFacts, start });
    let release = () => {};
    const save: Job = { id: crypto.randomUUID(), taskId: '', status: 'queued', createdAt: 0 };
    queueJob({ kind: 'repaint', songId }, save, () => new Promise<void>((r) => { release = () => { save.status = 'done'; r(); }; }));
    expect(getRunning()?.jobId).toBe(save.id);
    expect(start).not.toHaveBeenCalled();
    release();
    await vi.waitFor(() => expect(start).toHaveBeenCalledWith(songId));
    expect(getQueued()).toEqual([]);
  });

  it('a listener error never reaches the job; a full queue is logged, not thrown', () => {
    const { songId } = song();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    stop = startAnalysisTrigger({ facts: songFacts, start: () => { throw new Error('the queue is full'); } });
    expect(() => emitJobSettled({ jobId: 'j', kind: 'generate', status: 'done', songId })).not.toThrow();
    expect(log).toHaveBeenCalledWith(expect.stringContaining(songId), 'the queue is full');
    log.mockRestore();
  });

  it('ensureAnalysis starts one for an unread chat song and nothing otherwise', () => {
    const { songId, v } = song();
    const start = vi.fn((_id: string) => ({ id: 'a' }) as Job);
    expect(ensureAnalysis(songId, { facts: songFacts, start })).toEqual({ id: 'a' });
    writeAnalysis({ analysis_v: 1, versionId: v, failed: 'x', at: 't' });
    expect(ensureAnalysis(songId, { facts: songFacts, start })).toBeNull();
    expect(ensureAnalysis(song(false).songId, { facts: songFacts, start })).toBeNull();
    expect(start).toHaveBeenCalledTimes(1);
  });
});
