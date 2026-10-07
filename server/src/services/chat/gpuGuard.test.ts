import { describe, it, expect, vi } from 'vitest';
import { gpuGuard, type GpuGuardDeps } from './gpuGuard.js';

const deps = (over: Partial<GpuGuardDeps> = {}): GpuGuardDeps => ({
  plannerConfigured: true, planRunning: () => false, loaded: async () => [], ...over,
});

describe('gpuGuard (READ, CREATE SONG, CREATE COVER: no planner on the GPU)', () => {
  it('passes with nothing loaded', async () => {
    expect(await gpuGuard(deps())).toBeNull();
  });

  it('refuses while a planner model is loaded, naming it', async () => {
    const reason = await gpuGuard(deps({ loaded: async () => [{ name: 'qwen3:14b', contextLength: 16384 }] }));
    expect(reason).toContain('qwen3:14b');
  });

  it('passes while a plan job holds the slot: it unloads before the next job starts (D-011)', async () => {
    const loaded = vi.fn(async () => [{ name: 'qwen3:14b', contextLength: null }]);
    expect(await gpuGuard(deps({ planRunning: () => true, loaded }))).toBeNull();
    expect(loaded).not.toHaveBeenCalled();
  });

  it('asks nothing when no planner is set up, and reads an unreachable planner as empty', async () => {
    const loaded = vi.fn(async () => [{ name: 'x', contextLength: null }]);
    expect(await gpuGuard(deps({ plannerConfigured: false, loaded }))).toBeNull();
    expect(loaded).not.toHaveBeenCalled();
    expect(await gpuGuard(deps({ loaded: async () => { throw new Error('planner offline'); } }))).toBeNull();
  });
});
