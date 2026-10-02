import { describe, it, expect } from 'vitest';
import type { SplitHealth } from './api';
import { splitServiceLabel, splitBackendTitle } from './splitBackend';

const up: SplitHealth = { acestep: true, acestepError: null, demucs: true, demucsReason: null, demucsBackend: 'demucs' };
const uvr: SplitHealth = { ...up, demucsBackend: 'uvr' };
const unset: SplitHealth = { ...up, demucs: false, demucsReason: 'unset', demucsBackend: null };
const unreachable: SplitHealth = { ...up, demucs: false, demucsReason: 'unreachable', demucsBackend: null };

describe('splitServiceLabel', () => {
  it('reads UVR when uvr-server answers', () => {
    expect(splitServiceLabel(uvr)).toBe('UVR');
  });

  it('reads DEMUCS when demucs-server answers', () => {
    expect(splitServiceLabel(up)).toBe('DEMUCS');
  });

  it('keeps DEMUCS, the slot name, when nothing answers', () => {
    expect(splitServiceLabel(unset)).toBe('DEMUCS');
    expect(splitServiceLabel(unreachable)).toBe('DEMUCS');
  });
});

describe('splitBackendTitle', () => {
  it('says nothing about an ACE-Step that can extract', () => {
    expect(splitBackendTitle(up, 'acestep')).toBeUndefined();
  });

  it('tells "no extract model" apart from "couldn\'t check ACE-Step"', () => {
    expect(splitBackendTitle({ ...up, acestep: false }, 'acestep')).toMatch(/no downloaded model supports extract/);
    expect(splitBackendTitle({ ...up, acestep: false, acestepError: 'ACE-Step unreachable at x (ECONNREFUSED)' }, 'acestep'))
      .toBe("couldn't check ACE-Step");
  });

  it('names the split service that answers', () => {
    expect(splitBackendTitle(uvr, 'demucs')).toMatch(/^uvr-server/);
    expect(splitBackendTitle(up, 'demucs')).toMatch(/^demucs-server/);
  });

  it('tells an unset DEMUCS_API_URL apart from one where nothing answers', () => {
    expect(splitBackendTitle(unset, 'demucs')).toBe('no split service configured (DEMUCS_API_URL unset)');
    expect(splitBackendTitle(unreachable, 'demucs')).toMatch(/^no split service answers at DEMUCS_API_URL/);
  });
});
