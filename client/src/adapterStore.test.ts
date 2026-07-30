import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Adapter } from './api';

const listAdapters = vi.fn();
const registerAdapter = vi.fn();
const setActiveAdapter = vi.fn();
const setAdapterScale = vi.fn();
const deleteAdapter = vi.fn();

vi.mock('./api', () => ({
  api: {
    listAdapters: () => listAdapters(),
    registerAdapter: (name: string, path: string) => registerAdapter(name, path),
    setActiveAdapter: (id: string | null) => setActiveAdapter(id),
    setAdapterScale: (id: string, scale: number) => setAdapterScale(id, scale),
    deleteAdapter: (id: string) => deleteAdapter(id),
  },
}));

const { useAdapterStore, activeAdapter, adapterConsequence } = await import('./adapterStore');

const adapter = (over: Partial<Adapter> = {}): Adapter => ({
  id: 'a1',
  name: 'Acid House',
  path: '/models/acid',
  kind: 'lora',
  scale: 1,
  createdAt: '2026-07-31T00:00:00Z',
  ...over,
});

beforeEach(() => {
  useAdapterStore.setState({ adapters: [], activeId: null, warning: null, loaded: false });
  vi.clearAllMocks();
});

describe('fetchAdapters', () => {
  it('takes both the list and the active selection from the server', async () => {
    listAdapters.mockResolvedValue({ adapters: [adapter()], activeId: 'a1' });

    await useAdapterStore.getState().fetchAdapters();

    expect(useAdapterStore.getState().adapters).toHaveLength(1);
    expect(useAdapterStore.getState().activeId).toBe('a1');
  });
});

describe('select', () => {
  it('records the server\'s warning when the selection could not be applied yet', async () => {
    setActiveAdapter.mockResolvedValue({ activeId: 'a1', warning: 'ACE-Step -> Model not initialized' });

    await useAdapterStore.getState().select('a1');

    expect(useAdapterStore.getState().activeId).toBe('a1'); // still selected
    expect(useAdapterStore.getState().warning).toContain('Model not initialized');
  });

  it('clears a stale warning once a later call succeeds', async () => {
    useAdapterStore.setState({ warning: 'ACE-Step -> Model not initialized' });
    setActiveAdapter.mockResolvedValue({ activeId: null });

    await useAdapterStore.getState().select(null);

    expect(useAdapterStore.getState().warning).toBeNull();
  });
});

describe('setScale', () => {
  it('applies the new scale to just that adapter', async () => {
    useAdapterStore.setState({ adapters: [adapter(), adapter({ id: 'a2', name: 'Choir' })] });
    setAdapterScale.mockResolvedValue({ ...adapter(), scale: 0.4 });

    await useAdapterStore.getState().setScale('a1', 0.4);

    const { adapters } = useAdapterStore.getState();
    expect(adapters.find((a) => a.id === 'a1')?.scale).toBe(0.4);
    expect(adapters.find((a) => a.id === 'a2')?.scale).toBe(1);
  });
});

describe('remove', () => {
  it('drops the row and follows the server on whether anything is still selected', async () => {
    useAdapterStore.setState({ adapters: [adapter()], activeId: 'a1' });
    deleteAdapter.mockResolvedValue({ activeId: null });

    await useAdapterStore.getState().remove('a1');

    expect(useAdapterStore.getState().adapters).toHaveLength(0);
    expect(useAdapterStore.getState().activeId).toBeNull();
  });
});

describe('register', () => {
  it('refetches so the new adapter appears', async () => {
    registerAdapter.mockResolvedValue(adapter());
    listAdapters.mockResolvedValue({ adapters: [adapter()], activeId: null });

    await useAdapterStore.getState().register('Acid House', '/models/acid');

    expect(useAdapterStore.getState().adapters).toHaveLength(1);
  });

  it('rethrows so the form can show why the path was rejected', async () => {
    registerAdapter.mockRejectedValue(new Error('ACE-Step /v1/lora/load -> adapter_config.json is missing'));

    await expect(useAdapterStore.getState().register('Broken', '/nope')).rejects.toThrow('adapter_config.json');
    expect(listAdapters).not.toHaveBeenCalled();
  });
});

describe('activeAdapter', () => {
  it('is null when nothing is selected, or when the selection is not in the list', () => {
    expect(activeAdapter({ adapters: [adapter()], activeId: null })).toBeNull();
    expect(activeAdapter({ adapters: [adapter()], activeId: 'gone' })).toBeNull();
    expect(activeAdapter({ adapters: [adapter()], activeId: 'a1' })?.name).toBe('Acid House');
  });
});

describe('adapterConsequence', () => {
  it('names the adapter, its strength, and how far the selection reaches', () => {
    const line = adapterConsequence(adapter({ scale: 0.8 }));

    expect(line).toContain('Acid House at 80%');
    expect(line).toContain('every generation');
  });

  it('says plainly when nothing is applied', () => {
    expect(adapterConsequence(null)).toContain('base model');
  });
});

describe('ensureLoaded', () => {
  it('reads the list once even when several commit surfaces ask at the same time', async () => {
    // The Editor mounts the repaint, add-layer and remaster surfaces together.
    listAdapters.mockResolvedValue({ adapters: [], activeId: null });
    const { ensureLoaded } = useAdapterStore.getState();

    await Promise.all([ensureLoaded(), ensureLoaded(), ensureLoaded()]);

    expect(listAdapters).toHaveBeenCalledTimes(1);
  });

  it('does not keep re-asking when the registry is legitimately empty', async () => {
    listAdapters.mockResolvedValue({ adapters: [], activeId: null });
    const { ensureLoaded } = useAdapterStore.getState();
    await ensureLoaded();

    await ensureLoaded();

    expect(listAdapters).toHaveBeenCalledTimes(1);
  });
});
