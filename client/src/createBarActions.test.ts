/** Each chip confirm goes to the API that owns it: a queued job's CANCEL goes to the queue route,
 * a running job's ABORT to the lock's abort route. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useApiStatusStore } from './apiStatusStore';
import { confirmChip, targetKey } from './createBarActions';

const calls = vi.hoisted(() => ({ cancel: [] as string[], abort: 0 }));
vi.mock('./api', async (orig) => {
  const mod = await orig<typeof import('./api')>();
  return {
    ...mod,
    api: {
      ...mod.api,
      cancelJob: (id: string) => { calls.cancel.push(id); return Promise.resolve({}); },
      abortActive: () => { calls.abort++; return Promise.resolve({ ok: true, aborted: true }); },
      queue: () => Promise.resolve({ running: null, queued: [] }),
    },
  };
});

beforeEach(() => { calls.cancel = []; calls.abort = 0; });

describe('confirmChip', () => {
  it('a queued job: the queue cancel route with its id, never the abort', async () => {
    await confirmChip({ kind: 'cancel', jobId: 'q7' });
    expect(calls).toEqual({ cancel: ['q7'], abort: 0 });
  });

  it('the running job: the active abort, never the queue cancel', async () => {
    useApiStatusStore.setState({ active: { kind: 'generate', jobId: 'r1', startedAt: 1, status: 'running' } });
    await confirmChip({ kind: 'abort', jobId: 'r1' });
    expect(calls).toEqual({ cancel: [], abort: 1 });
  });

  it('keys one confirm per chip', () => {
    expect(targetKey({ kind: 'abort', jobId: 'r1' })).toBe('abort:r1');
    expect(targetKey({ kind: 'cancel', jobId: 'q7' })).toBe('cancel:q7');
  });
});
