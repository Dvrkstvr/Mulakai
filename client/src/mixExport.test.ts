import { describe, it, expect } from 'vitest';
import type { Layer, Version } from './api';
import { mixFilename, mixInputs } from './mixExport';

const version = (file: string, active: boolean) => ({ id: file, audio_file: file, active: active ? 1 : 0 }) as Version;

const layer = (name: string, opts: Partial<Pick<Layer, 'muted' | 'solo' | 'volume'>> & { takes?: Version[] } = {}): Layer => ({
  id: name, name, kind: name === 'base' ? 'base' : 'layer', position: 0, region_start: 0, region_end: null,
  volume: opts.volume ?? 1, muted: opts.muted ?? 0, solo: opts.solo ?? 0,
  versions: opts.takes ?? [version(`${name}-v2.wav`, true), version(`${name}-v1.wav`, false)],
});

const files = (layers: Layer[]) => mixInputs(layers).map((i) => i.audioUrl);

describe('mixInputs', () => {
  it("bounces every unmuted layer's active take at its own volume", () => {
    const inputs = mixInputs([layer('base', { volume: 0.8 }), layer('vocals', { volume: 0.5 })]);
    expect(inputs).toEqual([
      { id: '0', audioUrl: '/audio/base-v2.wav', volume: 0.8 },
      { id: '1', audioUrl: '/audio/vocals-v2.wav', volume: 0.5 },
    ]);
  });

  it('leaves muted layers out', () => {
    expect(files([layer('base'), layer('vocals', { muted: 1 })])).toEqual(['/audio/base-v2.wav']);
  });

  it('plays only the soloed layers while any is soloed, even a muted one', () => {
    const layers = [layer('base'), layer('vocals', { solo: 1, muted: 1 }), layer('drums')];
    expect(files(layers)).toEqual(['/audio/vocals-v2.wav']);
  });

  it('skips a layer with no active take, and is empty when nothing is audible', () => {
    expect(files([layer('base'), layer('vocals', { takes: [version('x.wav', false)] })])).toEqual(['/audio/base-v2.wav']);
    expect(mixInputs([layer('base', { muted: 1 })])).toEqual([]);
  });
});

describe('mixFilename', () => {
  it("is the song's title as a WAV", () => {
    expect(mixFilename('Copper Sky')).toBe('Copper Sky.wav');
    expect(mixFilename('  ')).toBe('mix.wav');
  });
});
