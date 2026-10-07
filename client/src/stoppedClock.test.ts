import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DIM_WINDOW_MS } from './footerMode';
import { watchStop } from './stoppedClock';

describe('watchStop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => vi.useRealTimers());

  it('stamps the stop and wakes exactly when the dim window runs out', () => {
    const stamp = vi.fn();
    const expire = vi.fn();
    watchStop(false, stamp, expire);
    expect(stamp).toHaveBeenCalledWith(1_000_000);
    vi.advanceTimersByTime(DIM_WINDOW_MS - 1);
    expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(expire).toHaveBeenCalledTimes(1);
    expect(Date.now() - stamp.mock.calls[0][0]).toBe(DIM_WINDOW_MS);
  });

  it('clears the stamp and sets no timer while playing', () => {
    const stamp = vi.fn();
    const expire = vi.fn();
    watchStop(true, stamp, expire);
    expect(stamp).toHaveBeenCalledWith(null);
    vi.advanceTimersByTime(DIM_WINDOW_MS * 2);
    expect(expire).not.toHaveBeenCalled();
  });

  it('a cleanup (play resumed, new song) cancels the pending wake', () => {
    const expire = vi.fn();
    const cleanup = watchStop(false, vi.fn(), expire);
    vi.advanceTimersByTime(DIM_WINDOW_MS / 2);
    cleanup();
    vi.advanceTimersByTime(DIM_WINDOW_MS);
    expect(expire).not.toHaveBeenCalled();
  });

  it('honours a custom window', () => {
    const expire = vi.fn();
    watchStop(false, vi.fn(), expire, 5_000);
    vi.advanceTimersByTime(5_000);
    expect(expire).toHaveBeenCalledTimes(1);
  });
});
