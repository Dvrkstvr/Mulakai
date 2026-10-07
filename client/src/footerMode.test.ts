import { describe, it, expect } from 'vitest';
import { DIM_WINDOW_MS, footerMode, type FooterInputs } from './footerMode';

const base: FooterInputs = {
  hasSong: true, isPlaying: true, msSinceStopped: 0, generating: false, onLibrary: true, peeking: false,
};
const mode = (over: Partial<FooterInputs>) => footerMode({ ...base, ...over });

describe('footerMode', () => {
  it('is shown while a loaded song plays on the Library', () => {
    expect(mode({})).toBe('shown');
  });

  it('dims a paused or ended song for under 60 s', () => {
    expect(mode({ isPlaying: false, msSinceStopped: 0 })).toBe('dimmed');
    expect(mode({ isPlaying: false, msSinceStopped: DIM_WINDOW_MS - 1 })).toBe('dimmed');
  });

  it('hides once the song has not played for 60 s', () => {
    expect(DIM_WINDOW_MS).toBe(60_000);
    expect(mode({ isPlaying: false, msSinceStopped: DIM_WINDOW_MS })).toBe('hidden');
  });

  it('ignores the stop clock while playing', () => {
    expect(mode({ isPlaying: true, msSinceStopped: DIM_WINDOW_MS * 5 })).toBe('shown');
  });

  it('hides during a song generation, playing or not', () => {
    expect(mode({ generating: true })).toBe('hidden');
    expect(mode({ generating: true, isPlaying: false })).toBe('hidden');
  });

  it('hides off the Library, even when peeked', () => {
    expect(mode({ onLibrary: false })).toBe('hidden');
    expect(mode({ onLibrary: false, peeking: true })).toBe('hidden');
  });

  it('hides with no song loaded, even when peeked', () => {
    expect(mode({ hasSong: false })).toBe('hidden');
    expect(mode({ hasSong: false, peeking: true })).toBe('hidden');
  });

  it('a hover or edge peek shows it from dimmed, timed out, or during a generation', () => {
    expect(mode({ isPlaying: false, peeking: true })).toBe('shown');
    expect(mode({ isPlaying: false, msSinceStopped: DIM_WINDOW_MS * 2, peeking: true })).toBe('shown');
    expect(mode({ generating: true, peeking: true })).toBe('shown');
  });
});
