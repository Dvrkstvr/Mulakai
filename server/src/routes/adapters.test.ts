import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { Server } from 'node:http';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-adapters-test-'));

const loadLora = vi.fn(async (_path: string) => {});
const unloadLora = vi.fn(async () => {});
const setLoraScale = vi.fn(async (_scale: number) => {});

vi.mock('../services/acestep.js', () => ({
  loadLora: (p: string) => loadLora(p),
  unloadLora: () => unloadLora(),
  setLoraScale: (s: number) => setLoraScale(s),
  loraStatus: async () => ({ loaded: true, active: true, scale: 1, adapterType: 'lora' }),
  getModelGeneration: () => 0,
}));

const { db } = await import('../db/index.js');
const { adaptersRouter } = await import('./adapters.js');
const { resetAppliedAdapter } = await import('../services/adapters.js');

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/adapters', adaptersRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}/api/adapters`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  db.exec(`DELETE FROM adapters`);
  db.prepare(`UPDATE adapter_state SET active_adapter_id = NULL WHERE id = 1`).run();
  resetAppliedAdapter();
  vi.clearAllMocks();
});

const post = (body: unknown) => fetch(baseUrl, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const patch = (suffix: string, body: unknown) => fetch(`${baseUrl}${suffix}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

async function create(name = 'Acid House', p = '/models/acid') {
  const res = await post({ name, path: p });
  return await res.json() as { id: string; kind: string };
}

describe('POST /', () => {
  it('registers an adapter', async () => {
    const res = await post({ name: 'Acid House', path: '/models/acid' });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: 'Acid House', path: '/models/acid', kind: 'lora', scale: 1 });
  });

  it('rejects a blank name or path without calling ACE-Step', async () => {
    expect((await post({ name: '  ', path: '/models/acid' })).status).toBe(400);
    expect((await post({ name: 'Acid House', path: '' })).status).toBe(400);
    expect(loadLora).not.toHaveBeenCalled();
  });

  it('returns ACE-Step\'s own message when the path is not a loadable adapter', async () => {
    loadLora.mockRejectedValueOnce(new Error('ACE-Step /v1/lora/load -> adapter_config.json is missing'));

    const res = await post({ name: 'Broken', path: '/nope' });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('adapter_config.json is missing');
  });
});

describe('PATCH /active', () => {
  it('selects an adapter and pushes it to ACE-Step', async () => {
    const adapter = await create();
    vi.clearAllMocks();

    const res = await patch('/active', { id: adapter.id });

    expect(await res.json()).toMatchObject({ activeId: adapter.id });
    expect(loadLora).toHaveBeenCalledWith('/models/acid');
  });

  it('is not swallowed by the /:id route', async () => {
    // "active" would otherwise be read as an adapter id and 404 on the scale route.
    const res = await patch('/active', { id: null });

    expect(res.status).toBe(200);
  });

  it('404s on an unknown id', async () => {
    expect((await patch('/active', { id: 'nope' })).status).toBe(404);
  });

  it('records the selection but warns when ACE-Step cannot apply it yet', async () => {
    const adapter = await create();
    loadLora.mockRejectedValueOnce(new Error('ACE-Step /v1/lora/load -> Model not initialized'));

    const body = await (await patch('/active', { id: adapter.id })).json();

    expect(body.activeId).toBe(adapter.id); // still recorded
    expect(body.warning).toContain('Model not initialized');
  });
});

describe('PATCH /:id', () => {
  it('sets the strength and re-applies it', async () => {
    const adapter = await create();
    await patch('/active', { id: adapter.id });
    vi.clearAllMocks();

    const body = await (await patch(`/${adapter.id}`, { scale: 0.4 })).json();

    expect(body.scale).toBe(0.4);
    expect(setLoraScale).toHaveBeenCalledWith(0.4);
  });

  it('rejects a non-numeric scale', async () => {
    const adapter = await create();

    expect((await patch(`/${adapter.id}`, { scale: 'loud' })).status).toBe(400);
  });
});

describe('DELETE /:id', () => {
  it('deletes the adapter, clears the selection, and unloads it', async () => {
    const adapter = await create();
    await patch('/active', { id: adapter.id });
    vi.clearAllMocks();

    const body = await (await fetch(`${baseUrl}/${adapter.id}`, { method: 'DELETE' })).json();

    expect(body.activeId).toBeNull();
    expect(unloadLora).toHaveBeenCalledTimes(1);
    expect((await (await fetch(baseUrl)).json()).adapters).toHaveLength(0);
  });
});
