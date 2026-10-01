import { describe, it, expect } from 'vitest';
import { splitServiceLabel, splitServiceTitle, SPLIT_HEALTH_DOWN, type SplitHealth } from './splitBackend';

const uvr: SplitHealth = { acestep: true, demucs: true, demucsBackend: 'uvr' };
const demucs: SplitHealth = { acestep: true, demucs: true, demucsBackend: 'demucs' };

describe('splitServiceLabel', () => {
  it('reads UVR when uvr-server answers', () => {
    expect(splitServiceLabel(uvr)).toBe('UVR');
  });

  it('reads DEMUCS when demucs-server answers', () => {
    expect(splitServiceLabel(demucs)).toBe('DEMUCS');
  });

  it('keeps DEMUCS, the slot name, when nothing answers', () => {
    expect(splitServiceLabel(SPLIT_HEALTH_DOWN)).toBe('DEMUCS');
  });
});

describe('splitServiceTitle', () => {
  it('names the service that answers', () => {
    expect(splitServiceTitle(uvr)).toMatch(/^uvr-server/);
    expect(splitServiceTitle(demucs)).toMatch(/^demucs-server/);
  });

  it('says nothing answers, not that the URL is unset, when the slot is down', () => {
    expect(splitServiceTitle(SPLIT_HEALTH_DOWN)).toMatch(/no split service answers at DEMUCS_API_URL/);
  });
});
