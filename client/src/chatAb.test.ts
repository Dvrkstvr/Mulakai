/** A/B between the song and its reference (F-062, RF-6): which source plays and where it resumes, clamped. */
import { describe, expect, it } from 'vitest';
import type { ReferenceView } from './api/chatReferences';
import { abPosition, abReference, abResume, abSide, abSource, abToggle } from './chatAb';

const SRC = { song: '/audio/take.wav', reference: '/audio/references/r1.mp3' };
const ref = (id: string, url = `/audio/references/${id}.mp3`) => ({ id, url } as ReferenceView);

describe('chatAb', () => {
  it('plays the song, or the reference when that side is picked and one exists', () => {
    expect(abSource(SRC, 'song')).toBe(SRC.song);
    expect(abSource(SRC, 'reference')).toBe(SRC.reference);
    expect(abSource({ ...SRC, reference: null }, 'reference')).toBe(SRC.song);
    expect(abSide({ ...SRC, reference: null }, 'reference')).toBe('song');
    expect(abToggle('song')).toBe('reference');
    expect(abToggle('reference')).toBe('song');
  });
  it('the same seconds, clamped to the other file: past its end it stops at the end', () => {
    expect(abPosition(72, 192)).toEqual({ at: 72, ended: false });
    expect(abPosition(250, 192)).toEqual({ at: 192, ended: true });
    expect(abPosition(-3, 192)).toEqual({ at: 0, ended: false });
    expect(abPosition(Number.NaN, 192)).toEqual({ at: 0, ended: false });
  });
  it('resumes once the new file knows its length, and plays on only if it was playing and has not ended', () => {
    expect(abResume({ at: 72, play: true }, 0)).toBeNull();
    expect(abResume({ at: 72, play: true }, 192)).toEqual({ seek: 72, play: true });
    expect(abResume({ at: 72, play: false }, 192)).toEqual({ seek: 72, play: false });
    expect(abResume({ at: 250, play: true }, 192)).toEqual({ seek: 192, play: false });
  });
  it('the reference to A/B against: the newest one with a file', () => {
    expect(abReference(undefined)).toBeNull();
    expect(abReference([])).toBeNull();
    expect(abReference([ref('a'), ref('b')])?.id).toBe('b');
    expect(abReference([ref('a'), ref('b', '')])?.id).toBe('a');
  });
});
