import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));

const express = (await import('express')).default;
const { config } = await import('../config.js');
const { voicesRouter } = await import('./voices.js');

const app = express();
app.use(express.json());
app.use('/api/voices', voicesRouter);

let baseUrl: string;
let server: ReturnType<typeof app.listen>;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}/api/voices`;
      resolve();
    });
  });
});

afterAll(() => server.close());

function uploadVoice(name: string, audioContent = 'fake voice bytes') {
  const form = new FormData();
  form.append('name', name);
  form.append('audio', new Blob([audioContent]), 'clip.mp3');
  return fetch(baseUrl, { method: 'POST', body: form }).then((r) => r.json());
}

describe('voices routes', () => {
  it('lists no voices initially', async () => {
    const res = await fetch(baseUrl).then((r) => r.json());
    expect(res).toEqual([]);
  });

  it('creates a voice, storing the file on disk and defaults in the row', async () => {
    const voice = await uploadVoice('My Voice');
    expect(voice.name).toBe('My Voice');
    expect(voice.default_audio_influence).toBe(0.5);
    expect(voice.default_style_influence).toBe(0.5);
    expect(fs.existsSync(path.join(config.audioDir, voice.audio_file))).toBe(true);

    const list = await fetch(baseUrl).then((r) => r.json());
    expect(list).toHaveLength(1);
  });

  it('rejects creation without a name or audio file', async () => {
    const noName = await fetch(baseUrl, { method: 'POST', body: new FormData() });
    expect(noName.status).toBe(400);

    const form = new FormData();
    form.append('name', 'no audio');
    const noAudio = await fetch(baseUrl, { method: 'POST', body: form });
    expect(noAudio.status).toBe(400);
  });

  it('updates name and influence defaults via PATCH', async () => {
    const voice = await uploadVoice('Renamable');
    const updated = await fetch(`${baseUrl}/${voice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed', default_audio_influence: 0.8 }),
    }).then((r) => r.json());
    expect(updated.name).toBe('Renamed');
    expect(updated.default_audio_influence).toBe(0.8);
    expect(updated.default_style_influence).toBe(0.5); // unchanged
  });

  it('404s patching an unknown voice', async () => {
    const res = await fetch(`${baseUrl}/nope`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),
    });
    expect(res.status).toBe(404);
  });

  it('deletes a voice and its audio file', async () => {
    const voice = await uploadVoice('Deletable');
    const filePath = path.join(config.audioDir, voice.audio_file);
    expect(fs.existsSync(filePath)).toBe(true);

    const del = await fetch(`${baseUrl}/${voice.id}`, { method: 'DELETE' });
    expect(del.status).toBe(200);
    expect(fs.existsSync(filePath)).toBe(false);

    const stillThere = await fetch(`${baseUrl}/${voice.id}`, { method: 'DELETE' });
    expect(stillThere.status).toBe(404);
  });
});
