import { describe, it, expect, vi } from 'vitest';
import { attempt, errorText } from './actionError';

describe('errorText', () => {
  it("reads an Error's message and stringifies anything else", () => {
    expect(errorText(new Error('HTTP 500'))).toBe('HTTP 500');
    expect(errorText('offline')).toBe('offline');
  });
});

describe('attempt', () => {
  it('clears the last error, runs the action and reports success', async () => {
    const setError = vi.fn();
    const action = vi.fn().mockResolvedValue(undefined);
    await expect(attempt("couldn't mute", action, setError)).resolves.toBe(true);
    expect(action).toHaveBeenCalledOnce();
    expect(setError.mock.calls).toEqual([['']]);
  });

  it('shows "label — why" for a failure instead of rejecting', async () => {
    const setError = vi.fn();
    const ok = await attempt("couldn't mute", () => Promise.reject(new TypeError('Failed to fetch')), setError);
    expect(ok).toBe(false);
    expect(setError.mock.calls).toEqual([[''], ["couldn't mute — Failed to fetch"]]);
  });

  it('catches an action that throws synchronously', async () => {
    const setError = vi.fn();
    const ok = await attempt("couldn't revert", () => { throw new Error('boom'); }, setError);
    expect(ok).toBe(false);
    expect(setError).toHaveBeenLastCalledWith("couldn't revert — boom");
  });
});
