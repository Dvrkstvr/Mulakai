import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ReleaseTaskParams, TaskResult } from './acestep.js';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-lts-'));

// A plain stateful stub (not a vi.fn) stands in for the ACE-Step client here:
// vitest's spy settled-result tracking spuriously reports a *caught* throw as an
// unhandled rejection once the same spy has also recorded a resolved call, which
// would flag the "endpoint errors" case below even though the code handles it.
const stub = vi.hoisted(() => ({
  mode: 'ok' as 'ok' | 'empty' | 'throw',
  lastArg: undefined as unknown,
}));
vi.mock('./acestep.js', async (importActual) => {
  const actual = await importActual<typeof import('./acestep.js')>();
  return {
    ...actual,
    lyricTimestamp: async (p: unknown) => {
      stub.lastArg = p;
      if (stub.mode === 'throw') throw new Error('ACE-Step /lyric_timestamp -> HTTP 404');
      const sentence_timestamps =
        stub.mode === 'empty' ? [] : [{ start: 1, end: 4, text: '[Verse]' }, { start: 4, end: 8, text: 'line' }];
      return { lrc_text: '', sentence_timestamps, success: true, error: null };
    },
  };
});

// Importing jobs.js also runs db/index.js, which applies the additive
// `lyric_timestamps` migration on this fresh temp DB — so a clean import proves
// the migration doesn't throw.
const { fetchLyricTimestampsJson } = await import('./jobs.js');
const { rawPathFromAudioUrl } = await import('./acestep.js');

const result = (over: Partial<TaskResult> = {}): TaskResult => ({
  file: '/v1/audio?path=%2Ftmp%2Facestep%2Fabc.flac',
  status: 1,
  prompt: '',
  lyrics: '',
  metas: { duration: 30 },
  seed_value: '',
  ...over,
});
const params: ReleaseTaskParams = { vocal_language: 'en', inference_steps: 8 };

describe('rawPathFromAudioUrl', () => {
  it('decodes the raw filesystem path from a /v1/audio url', () => {
    expect(rawPathFromAudioUrl('/v1/audio?path=%2Ftmp%2Ff.flac')).toBe('/tmp/f.flac');
    expect(rawPathFromAudioUrl('/v1/audio?path=%2Fa%2Fb.flac&x=1')).toBe('/a/b.flac');
  });
  it('returns null when there is no path parameter', () => {
    expect(rawPathFromAudioUrl('/v1/audio')).toBeNull();
    expect(rawPathFromAudioUrl('')).toBeNull();
  });
});

describe('fetchLyricTimestampsJson', () => {
  beforeEach(() => {
    stub.mode = 'ok';
    stub.lastArg = undefined;
  });

  it('returns serialized sentence timestamps and passes the decoded raw path', async () => {
    const json = await fetchLyricTimestampsJson(result(), params);
    expect(json && JSON.parse(json)).toEqual([
      { start: 1, end: 4, text: '[Verse]' },
      { start: 4, end: 8, text: 'line' },
    ]);
    expect(stub.lastArg).toMatchObject({
      audioPath: '/tmp/acestep/abc.flac',
      duration: 30,
      vocalLanguage: 'en',
      inferenceSteps: 8,
    });
  });

  it('returns null when the endpoint errors (e.g. 404, no sidecar)', async () => {
    stub.mode = 'throw';
    expect(await fetchLyricTimestampsJson(result(), params)).toBeNull();
  });

  it('returns null when alignment yields no sentences', async () => {
    stub.mode = 'empty';
    expect(await fetchLyricTimestampsJson(result(), params)).toBeNull();
  });

  it('skips the request entirely when no duration is known', async () => {
    expect(await fetchLyricTimestampsJson(result({ metas: {} }), {})).toBeNull();
    expect(stub.lastArg).toBeUndefined();
  });

  it('skips the request when ACE-Step reports duration as "N/A" (repaint results)', async () => {
    expect(await fetchLyricTimestampsJson(result({ metas: { duration: 'N/A' as unknown as number } }), params)).toBeNull();
    expect(stub.lastArg).toBeUndefined();
  });
});
