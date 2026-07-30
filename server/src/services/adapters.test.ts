import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));

const loadLora = vi.fn(async (_path: string) => {});
const unloadLora = vi.fn(async () => {});
const setLoraScale = vi.fn(async (_scale: number) => {});
const loraStatus = vi.fn(async () => ({ loaded: true, active: true, scale: 1, adapterType: 'lora' as string | null }));
let generation = 0;

vi.mock('./acestep.js', () => ({
  loadLora: (p: string) => loadLora(p),
  unloadLora: () => unloadLora(),
  setLoraScale: (s: number) => setLoraScale(s),
  loraStatus: () => loraStatus(),
  getModelGeneration: () => generation,
}));

const { db } = await import('../db/index.js');
const {
  listAdapters, getActiveAdapter, setActiveAdapter, setAdapterScale,
  deleteAdapter, registerAdapter, reconcileAdapter, resetAppliedAdapter,
} = await import('./adapters.js');

/** Registers without asserting on the calls it makes, for tests about something else. */
async function seed(name: string, p: string) {
  const adapter = await registerAdapter(name, p);
  vi.clearAllMocks();
  return adapter;
}

beforeEach(() => {
  db.exec(`DELETE FROM adapters`);
  db.prepare(`UPDATE adapter_state SET active_adapter_id = NULL WHERE id = 1`).run();
  resetAppliedAdapter();
  generation = 0;
  vi.clearAllMocks();
  loraStatus.mockResolvedValue({ loaded: true, active: true, scale: 1, adapterType: 'lora' });
});

describe('registerAdapter', () => {
  it('validates by loading the path and records the adapter type ACE-Step reports', async () => {
    loraStatus.mockResolvedValue({ loaded: true, active: true, scale: 1, adapterType: 'lokr' });

    const adapter = await registerAdapter('Acid House', '/models/acid.safetensors');

    expect(loadLora).toHaveBeenCalledWith('/models/acid.safetensors');
    expect(adapter.kind).toBe('lokr');
    expect(listAdapters()).toHaveLength(1);
  });

  it('stores nothing when ACE-Step rejects the path', async () => {
    loadLora.mockRejectedValueOnce(new Error('ACE-Step /v1/lora/load -> adapter_config.json is missing'));

    await expect(registerAdapter('Broken', '/nope')).rejects.toThrow('adapter_config.json is missing');
    expect(listAdapters()).toHaveLength(0);
  });

  it('unloads the validation load again when the registered adapter is not the selected one', async () => {
    // Loading also activates it (ACE-Step sets lora_loaded/use_lora together), so registering
    // must not leave an unselected adapter colouring every subsequent generation.
    await registerAdapter('Acid House', '/models/acid');

    expect(unloadLora).toHaveBeenCalledTimes(1);
  });

  it('falls back to lora when the status call fails', async () => {
    loraStatus.mockRejectedValueOnce(new Error('Model not initialized'));

    const adapter = await registerAdapter('Acid House', '/models/acid');

    expect(adapter.kind).toBe('lora');
  });
});

describe('reconcileAdapter', () => {
  it('makes no request when nothing is selected and nothing was applied', async () => {
    await reconcileAdapter();

    expect(loadLora).not.toHaveBeenCalled();
    expect(unloadLora).not.toHaveBeenCalled();
  });

  it('loads the selected adapter and applies its scale', async () => {
    const adapter = await seed('Acid House', '/models/acid');
    setAdapterScale(adapter.id, 0.8);
    setActiveAdapter(adapter.id);

    await reconcileAdapter();

    expect(loadLora).toHaveBeenCalledWith('/models/acid');
    expect(setLoraScale).toHaveBeenCalledWith(0.8);
  });

  it('is idempotent — a second call with nothing changed makes no request', async () => {
    const adapter = await seed('Acid House', '/models/acid');
    setActiveAdapter(adapter.id);
    await reconcileAdapter();
    vi.clearAllMocks();

    await reconcileAdapter();

    expect(loadLora).not.toHaveBeenCalled();
    expect(setLoraScale).not.toHaveBeenCalled();
  });

  it('re-loads after the model is re-initialized, which silently drops the adapter', async () => {
    const adapter = await seed('Acid House', '/models/acid');
    setActiveAdapter(adapter.id);
    await reconcileAdapter();
    vi.clearAllMocks();

    generation++; // an /v1/init happened

    await reconcileAdapter();

    expect(loadLora).toHaveBeenCalledWith('/models/acid');
  });

  it('sets the scale without re-loading when only the scale changed', async () => {
    const adapter = await seed('Acid House', '/models/acid');
    setActiveAdapter(adapter.id);
    await reconcileAdapter();
    vi.clearAllMocks();

    setAdapterScale(adapter.id, 0.3);
    await reconcileAdapter();

    expect(loadLora).not.toHaveBeenCalled();
    expect(setLoraScale).toHaveBeenCalledWith(0.3);
  });

  it('unloads when the selection is cleared', async () => {
    const adapter = await seed('Acid House', '/models/acid');
    setActiveAdapter(adapter.id);
    await reconcileAdapter();
    vi.clearAllMocks();

    setActiveAdapter(null);
    await reconcileAdapter();

    expect(unloadLora).toHaveBeenCalledTimes(1);
  });

  it('swaps adapters when the selection changes', async () => {
    const acid = await seed('Acid House', '/models/acid');
    const choir = await seed('Choir', '/models/choir');
    setActiveAdapter(acid.id);
    await reconcileAdapter();
    vi.clearAllMocks();

    setActiveAdapter(choir.id);
    await reconcileAdapter();

    expect(loadLora).toHaveBeenCalledWith('/models/choir');
  });

  it('retries on the next call when loading failed, rather than assuming it applied', async () => {
    const adapter = await seed('Acid House', '/models/acid');
    setActiveAdapter(adapter.id);
    loadLora.mockRejectedValueOnce(new Error('ACE-Step /v1/lora/load -> Failed to load LoRA'));

    await expect(reconcileAdapter()).rejects.toThrow('Failed to load LoRA');
    await reconcileAdapter();

    expect(loadLora).toHaveBeenCalledTimes(2);
  });
});

describe('registry', () => {
  it('clears the active selection when the active adapter is deleted', async () => {
    const adapter = await seed('Acid House', '/models/acid');
    setActiveAdapter(adapter.id);

    deleteAdapter(adapter.id);

    expect(getActiveAdapter()).toBeNull();
    expect(listAdapters()).toHaveLength(0);
  });

  it('clamps scale to 0-1, the range ACE-Step accepts', async () => {
    const adapter = await seed('Acid House', '/models/acid');

    expect(setAdapterScale(adapter.id, 2.5).scale).toBe(1);
    expect(setAdapterScale(adapter.id, -1).scale).toBe(0);
  });

  it('rejects selecting an adapter that does not exist', async () => {
    expect(() => setActiveAdapter('nope')).toThrow('Unknown adapter');
  });
});
