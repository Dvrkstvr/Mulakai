import { describe, it, expect, vi } from 'vitest';
import { retryEntry } from './activityRetry';

describe('retryEntry', () => {
  it('starts the job, whatever else runs: the server queues it', () => {
    const retry = vi.fn(() => true);
    expect(retryEntry({ retry })).toBe('started');
    expect(retry).toHaveBeenCalledOnce();
  });

  it('reports busy when the owning store refuses to start', () => {
    expect(retryEntry({ retry: () => false })).toBe('busy');
  });

  it('reports busy with nothing to retry', () => {
    expect(retryEntry({})).toBe('busy');
  });
});
