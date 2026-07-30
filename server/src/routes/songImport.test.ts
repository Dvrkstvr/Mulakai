import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));

const express = (await import('express')).default;
const { config } = await import('../config.js');
const { db } = await import('../db/index.js');
const { songImportRouter } = await import('./songImport.js');
const { songsRouter } = await import('./songs.js');

const app = express();
app.use(express.json());
app.use('/api/songs', songImportRouter);
app.use('/api/songs', songsRouter);

let baseUrl: string;
let server: ReturnType<typeof app.listen>;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}/api/songs`;
      resolve();
    });
  });
});

afterAll(() => server.close());

function importSong(filename: string, fields: Record<string, string> = {}) {
  const form = new FormData();
  form.append('audio', new Blob(['fake audio bytes']), filename);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return fetch(`${baseUrl}/import`, { method: 'POST', body: form });
}

describe('song import route', () => {
  it('creates a song with a base layer and one active version, file on disk', async () => {
    const res = await importSong('My Track.mp3', { duration: '212.5', bpm: '128', key_scale: 'A minor' });
    expect(res.status).toBe(201);
    const song = await res.json();

    expect(song.title).toBe('My Track');
    expect(song.duration).toBe(212.5);
    expect(song.bpm).toBe(128);
    expect(song.key_scale).toBe('A minor');
    expect(song.gen_task).toBe('import');
    expect(song.audio_file).toMatch(/\.mp3$/);
    expect(fs.existsSync(path.join(config.audioDir, song.audio_file))).toBe(true);

    // The editor payload is what makes it repaintable: exactly one base layer with one
    // active version, indistinguishable in shape from a generated song.
    const detail = await fetch(`${baseUrl}/${song.id}`).then((r) => r.json());
    expect(detail.layers).toHaveLength(1);
    expect(detail.layers[0].kind).toBe('base');
    expect(detail.layers[0].versions).toHaveLength(1);
    expect(detail.layers[0].versions[0].active).toBe(1);
    expect(detail.layers[0].versions[0].label).toBe('imported');
    // Drives the client-side ALT/SIMILAR guard for unreplayable versions.
    expect(detail.layers[0].versions[0].task_type).toBe('import');
  });

  it('appears in the library list with playable audio', async () => {
    const song = await importSong('Listable.wav').then((r) => r.json());
    const list = await fetch(baseUrl).then((r) => r.json());
    const row = list.find((s: { id: string }) => s.id === song.id);
    expect(row).toBeDefined();
    expect(row.audio_file).toBe(song.audio_file);
  });

  it('carries optional prompt and lyrics onto the song', async () => {
    const song = await importSong('Analyzed.flac', {
      prompt: 'lofi hip hop, warm tape saturation',
      lyrics: '[verse]\nsome words',
    }).then((r) => r.json());
    expect(song.caption).toBe('lofi hip hop, warm tape saturation');
    // CRLF, not \n: multipart normalizes line breaks in field values. Pre-existing for
    // every lyrics-carrying form post in this app (see client api.ts's startFromAudio).
    expect(song.lyrics).toBe('[verse]\r\nsome words');
  });

  it('defaults unknown metadata to null/empty rather than guessing', async () => {
    const song = await importSong('Bare.ogg').then((r) => r.json());
    expect(song.duration).toBeNull();
    expect(song.bpm).toBeNull();
    expect(song.caption).toBe('');
    expect(song.lyrics).toBe('');
    expect(song.folder_id).toBeNull();
  });

  it('ignores unparseable numeric fields instead of storing NaN', async () => {
    const song = await importSong('Junk.wav', { duration: 'abc', bpm: '' }).then((r) => r.json());
    expect(song.duration).toBeNull();
    expect(song.bpm).toBeNull();
  });

  it('requires an audio file', async () => {
    const res = await fetch(`${baseUrl}/import`, { method: 'POST', body: new FormData() });
    expect(res.status).toBe(400);
  });

  it('rejects non-audio extensions, which /audio would serve from the app origin', async () => {
    for (const name of ['payload.html', 'payload.svg', 'noext']) {
      const res = await importSong(name);
      expect(res.status).toBe(400);
    }
    // Nothing was written for the rejected uploads.
    expect(fs.readdirSync(config.audioDir).some((f) => /\.(html|svg)$/.test(f))).toBe(false);
  });

  it('files the song into a folder, and rejects an unknown one', async () => {
    db.prepare(`INSERT INTO folders (id, name) VALUES ('f1', 'Demos')`).run();
    const song = await importSong('Filed.wav', { folder_id: 'f1' }).then((r) => r.json());
    expect(song.folder_id).toBe('f1');

    const bad = await importSong('Misfiled.wav', { folder_id: 'nope' });
    expect(bad.status).toBe(400);
  });

  it('falls back to Untitled when the filename carries no usable name', async () => {
    const song = await importSong('   .wav').then((r) => r.json());
    expect(song.title).toBe('Untitled');
  });

  it('refuses ALT/SIMILAR on an imported version — there is no generation to replay', async () => {
    const song = await importSong('Unreplayable.wav').then((r) => r.json());
    const detail = await fetch(`${baseUrl}/${song.id}`).then((r) => r.json());
    const versionId = detail.layers[0].versions[0].id;

    const { versionsRouter } = await import('./versions.js');
    const guardApp = express();
    guardApp.use(express.json());
    guardApp.use('/api/layers', versionsRouter);
    const guardServer = guardApp.listen(0);
    const { port } = guardServer.address() as AddressInfo;
    try {
      for (const action of ['regenerate', 'retake']) {
        const res = await fetch(`http://127.0.0.1:${port}/api/layers/versions/${versionId}/${action}`, { method: 'POST' });
        expect(res.status).toBe(400);
        expect((await res.json()).error).toMatch(/no generation to replay/);
      }
    } finally {
      guardServer.close();
    }
  });
});
