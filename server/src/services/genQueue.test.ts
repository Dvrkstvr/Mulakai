import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  enqueue, releaseSlot, cancelQueued, cancelQueuedForSong, getRunning, getQueued, queuePosition, resetQueue,
  QueueFullError, QUEUE_LIMIT,
} from './genQueue.js';

afterEach(() => resetQueue());

/** A job body that runs until `finish` (or `fail`) is called. */
function held() {
  let finish!: () => void;
  let fail!: (err: Error) => void;
  const run = vi.fn(() => new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; }));
  return { run, finish: () => finish(), fail: (err: Error) => fail(err) };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('genQueue', () => {
  it('starts a job at once on a free slot and reports it as running', () => {
    const a = held();
    expect(enqueue({ kind: 'generate', jobId: 'a', title: 'Song' }, a.run)).toBe(0);
    expect(a.run).toHaveBeenCalledTimes(1);
    expect(getRunning()).toMatchObject({ kind: 'generate', jobId: 'a', title: 'Song' });
    expect(getQueued()).toEqual([]);
  });

  it('runs queued jobs first in, first out, with 1-based positions', async () => {
    const a = held(); const b = held(); const c = held();
    enqueue({ kind: 'generate', jobId: 'a' }, a.run);
    expect(enqueue({ kind: 'repaint', jobId: 'b', songId: 's', layer: 'Vocals', label: 'repaint 0:10–0:20' }, b.run)).toBe(1);
    expect(enqueue({ kind: 'split', jobId: 'c' }, c.run)).toBe(2);
    expect(getQueued().map((q) => [q.jobId, q.position])).toEqual([['b', 1], ['c', 2]]);
    expect(getQueued()[0]).toMatchObject({ layer: 'Vocals', label: 'repaint 0:10–0:20', songId: 's' });
    expect(b.run).not.toHaveBeenCalled();

    a.finish();
    await vi.waitFor(() => expect(getRunning()?.jobId).toBe('b'));
    expect(queuePosition('c')).toBe(1);
    expect(c.run).not.toHaveBeenCalled();
    b.finish();
    await vi.waitFor(() => expect(getRunning()?.jobId).toBe('c'));
    c.finish();
    await vi.waitFor(() => expect(getRunning()).toBeNull());
  });

  it('frees the slot when a job fails, throws synchronously, or is released by an abort', async () => {
    const a = held(); const b = held();
    enqueue({ kind: 'generate', jobId: 'a' }, a.run);
    enqueue({ kind: 'generate', jobId: 'b' }, b.run);
    a.fail(new Error('CUDA out of memory'));
    await vi.waitFor(() => expect(getRunning()?.jobId).toBe('b'));

    const c = vi.fn(() => { throw new Error('sync boom'); });
    const d = held();
    enqueue({ kind: 'analyze', jobId: 'c' }, c);
    enqueue({ kind: 'analyze', jobId: 'd' }, d.run);
    releaseSlot('b'); // ABORT: b's backend call is ignored, the next job starts now
    await vi.waitFor(() => expect(getRunning()?.jobId).toBe('d'));
    expect(c).toHaveBeenCalled();

    b.finish(); // the aborted body settling later frees nothing it doesn't hold
    await tick();
    expect(getRunning()?.jobId).toBe('d');
  });

  it('takes a queued job out of line with its reason, but never the running one', () => {
    const a = held(); const b = held(); const c = held();
    const onCancel = vi.fn();
    enqueue({ kind: 'generate', jobId: 'a' }, a.run);
    enqueue({ kind: 'repaint', jobId: 'b' }, b.run, onCancel);
    enqueue({ kind: 'repaint', jobId: 'c' }, c.run);

    expect(cancelQueued('a')).toBe(false);
    expect(cancelQueued('b')).toBe(true);
    expect(onCancel).toHaveBeenCalledWith('cancelled');
    expect(cancelQueued('b')).toBe(false);
    expect(queuePosition('c')).toBe(1);
    expect(b.run).not.toHaveBeenCalled();
    expect(getRunning()?.jobId).toBe('a');
  });

  it("cancels every queued job of a trashed song, and only that song's", () => {
    const a = held();
    const cancelled: string[] = [];
    enqueue({ kind: 'generate', jobId: 'a', songId: 's1' }, a.run, () => cancelled.push('a'));
    enqueue({ kind: 'repaint', jobId: 'b', songId: 's1' }, held().run, (r) => cancelled.push(`b:${r}`));
    enqueue({ kind: 'repaint', jobId: 'c', songId: 's2' }, held().run, () => cancelled.push('c'));
    enqueue({ kind: 'split', jobId: 'd', songId: 's1' }, held().run, (r) => cancelled.push(`d:${r}`));

    expect(cancelQueuedForSong('s1', 'trashed')).toEqual(['b', 'd']);
    expect(cancelled).toEqual(['b:trashed', 'd:trashed']);
    expect(getQueued().map((q) => q.jobId)).toEqual(['c']);
    expect(getRunning()?.jobId).toBe('a');
  });

  it(`refuses an entry past ${QUEUE_LIMIT} waiting, before queueing it`, () => {
    enqueue({ kind: 'generate', jobId: 'running' }, held().run);
    for (let i = 0; i < QUEUE_LIMIT; i += 1) enqueue({ kind: 'repaint', jobId: `q${i}` }, held().run);
    const extra = vi.fn();
    expect(() => enqueue({ kind: 'repaint', jobId: 'extra' }, extra)).toThrow(QueueFullError);
    expect(() => enqueue({ kind: 'repaint', jobId: 'extra' }, extra)).toThrow('the queue is full');
    expect(getQueued()).toHaveLength(QUEUE_LIMIT);
    expect(queuePosition('extra')).toBeUndefined();
  });

  it('ignores a release from a job that does not hold the slot', () => {
    enqueue({ kind: 'generate', jobId: 'a' }, held().run);
    enqueue({ kind: 'generate', jobId: 'b' }, held().run);
    releaseSlot('b');
    expect(getRunning()?.jobId).toBe('a');
    expect(queuePosition('b')).toBe(1);
  });
});
