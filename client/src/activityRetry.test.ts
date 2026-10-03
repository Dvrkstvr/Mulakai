import { describe, it, expect, vi } from 'vitest';
import { retryEntry } from './activityRetry';

describe('retryEntry', () => {
  it('starts the job when nothing runs', () => {
    const retry = vi.fn(() => true);
    expect(retryEntry({ retry }, false)).toBe('started');
    expect(retry).toHaveBeenCalledOnce();
  });

  it("doesn't try while another job runs", () => {
    const retry = vi.fn(() => true);
    expect(retryEntry({ retry }, true)).toBe('busy');
    expect(retry).not.toHaveBeenCalled();
  });

  it("reports busy when the owning store refuses to start", () => {
    expect(retryEntry({ retry: () => false }, false)).toBe('busy');
  });
});
