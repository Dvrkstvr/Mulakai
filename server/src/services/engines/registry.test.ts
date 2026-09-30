import { describe, it, expect, vi } from 'vitest';
import type { SongEngine } from './types.js';

const acestepHealth = vi.fn(async () => true);
const engineHealth = vi.fn(async (_e: { url: string }) => true);
vi.mock('../acestep.js', () => ({ health: () => acestepHealth() }));
vi.mock('../engineClient.js', () => ({ health: (e: { url: string }) => engineHealth(e) }));

// A developer's own engine URLs must not leak in: config reads them at import.
vi.stubEnv('YUE_API_URL', '');
vi.stubEnv('HEARTMULA_API_URL', '');
const { listEngines, getEngine, EXTRA_ENGINES, ACESTEP_CAPABILITIES } = await import('./registry.js');
const { YUE2_CAPABILITIES } = await import('./yue2.js');

function fake(id: SongEngine['id'], url: string): SongEngine {
  return {
    id, label: id.toUpperCase(), url, apiKey: '',
    capabilities: { ...ACESTEP_CAPABILITIES, duration: 'none', consequence: `${id} line` },
    toRequest: () => ({}),
    readMeta: () => ({ bpm: null, keyScale: '', timeSignature: '' }),
  };
}

describe('engine registry', () => {
  it('lists every extra engine as not configured, and never probes one, while its URL is unset', async () => {
    engineHealth.mockClear();
    expect(EXTRA_ENGINES.map((e) => e.id)).toEqual(['yue2', 'heartmula']);
    const list = await listEngines();
    expect(list[0]).toEqual(
      { id: 'acestep', label: 'ACE-STEP', capabilities: ACESTEP_CAPABILITIES, configured: true, ready: true },
    );
    expect(list.slice(1).map((e) => [e.id, e.configured, e.ready])).toEqual([['yue2', false, false], ['heartmula', false, false]]);
    expect(list[1].capabilities).toEqual(YUE2_CAPABILITIES);
    expect(engineHealth).not.toHaveBeenCalled();
  });

  it('lists ACE-Step first, then each extra engine in order, with live health', async () => {
    engineHealth.mockImplementation(async (e) => e.url.endsWith(':9000'));
    const list = await listEngines([fake('yue2', 'http://127.0.0.1:9000'), fake('heartmula', 'http://127.0.0.1:9001')]);
    expect(list.map((e) => [e.id, e.configured, e.ready])).toEqual([
      ['acestep', true, true],
      ['yue2', true, true],
      ['heartmula', true, false],
    ]);
    expect(list[1].capabilities.consequence).toBe('yue2 line');
  });

  it('reports an engine with no URL as not configured, without probing it', async () => {
    engineHealth.mockClear();
    const [, yue] = await listEngines([fake('yue2', '')]);
    expect(yue).toMatchObject({ configured: false, ready: false });
    expect(engineHealth).not.toHaveBeenCalled();
  });

  it('reports ACE-Step down when its health check fails', async () => {
    acestepHealth.mockImplementationOnce(async () => false);
    const [acestep] = await listEngines([]);
    expect(acestep.ready).toBe(false);
  });

  it('finds extra engines by id, never ACE-Step', () => {
    const engines = [fake('yue2', 'http://x')];
    expect(getEngine('yue2', engines)?.label).toBe('YUE2');
    expect(getEngine('acestep', engines)).toBeUndefined();
    expect(getEngine('nope', engines)).toBeUndefined();
  });
});
