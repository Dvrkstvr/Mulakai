import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { Server } from 'node:http';
import { mountClient } from './clientStatic.js';

const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-client-dist-'));
fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Mulakai</title>');
fs.mkdirSync(path.join(dist, 'assets'));
fs.writeFileSync(path.join(dist, 'assets', 'app.js'), 'console.log(1)');

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.get('/api/songs', (_req, res) => { res.json([]); });
  mountClient(app, dist);
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

afterAll(() => { server.close(); });

describe('mountClient', () => {
  it('serves index.html at the root and the built assets', async () => {
    expect(await (await fetch(`${baseUrl}/`)).text()).toContain('<title>Mulakai</title>');
    const js = await fetch(`${baseUrl}/assets/app.js`);
    expect(js.status).toBe(200);
    expect(await js.text()).toBe('console.log(1)');
  });

  it('falls back to index.html for a client route', async () => {
    const res = await fetch(`${baseUrl}/song/abc`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>Mulakai</title>');
  });

  it('leaves the API and audio alone', async () => {
    expect(await (await fetch(`${baseUrl}/api/songs`)).json()).toEqual([]);
    const api = await fetch(`${baseUrl}/api/nope`);
    expect(api.status).toBe(404);
    expect(await api.text()).not.toContain('<title>Mulakai</title>');
    expect((await fetch(`${baseUrl}/audio/missing.wav`)).status).toBe(404);
  });

  it('does not answer a POST with the page', async () => {
    expect((await fetch(`${baseUrl}/song/abc`, { method: 'POST' })).status).toBe(404);
  });
});

describe('config', () => {
  afterEach(() => { delete process.env.AUDIO_DIR; });

  it('audioDir follows AUDIO_DIR and falls back to DATA_DIR/audio', async () => {
    const { config } = await import('./config.js');
    expect(config.audioDir).toBe(path.join(config.dataDir, 'audio'));
    process.env.AUDIO_DIR = '/srv/mulakai-audio';
    expect(config.audioDir).toBe('/srv/mulakai-audio');
  });
});
