import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));
process.env.POLL_INTERVAL_MS = '5';

const finished = [{
  task_id: 'task-1',
  status: 1 as const,
  result: [{ file: '/v1/audio?path=x', status: 1 as const, prompt: '', lyrics: '', metas: {}, seed_value: '' }],
}];
const queryResult = vi.fn(async (..._args: unknown[]) => finished);
vi.mock('./acestep.js', () => ({ queryResult: (...args: unknown[]) => queryResult(...args) }));

const { poll, ABORTED_AFTER_SAVE } = await import('./jobRunner.js');
const { registerJob, abortJob, getJob } = await import('./jobRegistry.js');

let n = 0;
function runningJob() {
  const job = { id: `runner-${++n}`, taskId: 'task-1', status: 'running' as const, createdAt: Date.now() };
  registerJob(job);
  return getJob(job.id)!;
}

/** An onSuccess (download + persist) that waits until the test lets it finish or fail. */
function heldSave() {
  let finish!: (songId: string) => void;
  let fail!: (err: Error) => void;
  const started = vi.fn();
  const onSuccess = () => { started(); return new Promise<string>((res, rej) => { finish = res; fail = rej; }); };
  return { onSuccess, started, finish: (id: string) => finish(id), fail: (e: Error) => fail(e) };
}

beforeEach(() => {
  queryResult.mockReset();
  queryResult.mockImplementation(async () => finished);
});

describe('poll() and an abort', () => {
  it('finishes a job that was never aborted', async () => {
    const job = runningJob();
    await poll(job, async () => 'song-1');
    expect(job.status).toBe('done');
    expect(job.songId).toBe('song-1');
  });

  it('keeps an abort that lands while the result is being saved, and says the result was kept', async () => {
    const job = runningJob();
    const save = heldSave();
    const polling = poll(job, save.onSuccess);
    await vi.waitFor(() => expect(save.started).toHaveBeenCalled());

    expect(abortJob(job.id)).toBe(true); // the header's ABORT, mid-save
    save.finish('song-1');
    await polling;

    // Before the fix this flipped back to 'done' with no trace of the abort.
    expect(job.status).toBe('failed');
    expect(job.error).toBe(ABORTED_AFTER_SAVE);
    expect(job.songId).toBe('song-1');
  });

  it("keeps 'Aborted' when the save then fails, instead of the save's own error", async () => {
    const job = runningJob();
    const save = heldSave();
    const polling = poll(job, save.onSuccess);
    await vi.waitFor(() => expect(save.started).toHaveBeenCalled());

    abortJob(job.id);
    save.fail(new Error('disk full'));
    await polling;

    expect(job.status).toBe('failed');
    expect(job.error).toBe('Aborted');
  });

  it("keeps 'Aborted' when a status query in flight at the abort then fails", async () => {
    const job = runningJob();
    let rejectQuery!: (err: Error) => void;
    queryResult.mockImplementationOnce(() => new Promise((_res, rej) => { rejectQuery = rej; }));
    const polling = poll(job, async () => 'song-1');
    await vi.waitFor(() => expect(queryResult).toHaveBeenCalled());

    abortJob(job.id);
    rejectQuery(new Error('socket hang up'));
    await polling;

    expect(job.error).toBe('Aborted');
  });
});
