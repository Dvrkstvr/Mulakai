import { describe, expect, it, vi } from 'vitest';
import { assistTracker } from './assistTracker';

function deferred() {
  let resolve!: (v: { jobId: string }) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<{ jobId: string }>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('assistTracker', () => {
  it('keeps the answered job live', async () => {
    const cancel = vi.fn();
    const t = assistTracker(cancel);
    await expect(t.start(() => Promise.resolve({ jobId: 'a' }))).resolves.toBe('a');
    expect(t.isLive('a')).toBe(true);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('a new ask cancels the live job', async () => {
    const cancel = vi.fn();
    const t = assistTracker(cancel);
    await t.start(() => Promise.resolve({ jobId: 'a' }));
    await t.start(() => Promise.resolve({ jobId: 'b' }));
    expect(cancel).toHaveBeenCalledWith('a');
    expect(t.isLive('b')).toBe(true);
  });

  it('closed while the POST is in flight: that job is cancelled once its id arrives (StrictMode remount)', async () => {
    const cancel = vi.fn();
    const t = assistTracker(cancel);
    const first = deferred();
    const firstStart = t.start(() => first.promise);
    t.dispose();
    const second = t.start(() => Promise.resolve({ jobId: 'b' }));
    first.resolve({ jobId: 'a' });
    await expect(firstStart).resolves.toBeNull();
    await expect(second).resolves.toBe('b');
    expect(cancel.mock.calls).toEqual([['a']]);
    expect(t.isLive('a')).toBe(false);
    expect(t.isLive('b')).toBe(true);
  });

  it('dispose cancels the live job', async () => {
    const cancel = vi.fn();
    const t = assistTracker(cancel);
    await t.start(() => Promise.resolve({ jobId: 'a' }));
    t.dispose();
    expect(cancel).toHaveBeenCalledWith('a');
  });

  it('a settled job is not cancelled on close', async () => {
    const cancel = vi.fn();
    const t = assistTracker(cancel);
    await t.start(() => Promise.resolve({ jobId: 'a' }));
    t.settle();
    t.dispose();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('a failed POST rethrows only for the current ask', async () => {
    const t = assistTracker(vi.fn());
    await expect(t.start(() => Promise.reject(new Error('HTTP 503')))).rejects.toThrow('HTTP 503');
    const stale = deferred();
    const staleStart = t.start(() => stale.promise);
    t.dispose();
    stale.reject(new Error('HTTP 503'));
    await expect(staleStart).resolves.toBeNull();
  });
});
