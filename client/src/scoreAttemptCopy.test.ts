/** The review's line per earlier refused attempt (D-060; Q-036, Q-040): a moved phrase or tempo is never silent. */
import { describe, expect, it } from 'vitest';
import { refusedLines } from './scoreAttemptCopy';

describe('refusedLines (D-060)', () => {
  it('is empty when attempt 1 passed', () => {
    expect(refusedLines({ refusals: [] })).toEqual([]);
  });

  it('names the refused phrase bars in plain words, without the op address', () => {
    expect(refusedLines({ refusals: [['op 1 (WRITE_PHRASE): the Vocal sings in bars 20-23; free: 1-10, 47-65']] }))
      .toEqual(['attempt 1 refused: the Vocal sings in bars 20-23; free: 1-10, 47-65']);
  });

  it('names the tempo that did not fit (Q-036), one line per refused attempt', () => {
    expect(refusedLines({ refusals: [
      ['estimated 441 s: over the 360 s limit; at least 49 BPM fits'],
      ['op 2 (SET_TEMPO): bpm 30 is below 40'],
    ] })).toEqual([
      'attempt 1 refused: estimated 441 s: over the 360 s limit; at least 49 BPM fits',
      'attempt 2 refused: bpm 30 is below 40',
    ]);
  });

  it('shows the first two distinct reasons of a multi-reason attempt and counts the rest', () => {
    expect(refusedLines({ refusals: [[
      'op 1 (REHARMONIZE): from_bar 999 is outside the score (bars 1-65)',
      'op 1 (REHARMONIZE): from_bar 999 is outside the score (bars 1-65)',
      'op 1 (REHARMONIZE): to_bar 999 is outside the score (bars 1-65)',
      'chords changed outside the REHARMONIZE bars: 3',
      'Vocal bar 4 differs',
    ]] })).toEqual([
      'attempt 1 refused: from_bar 999 is outside the score (bars 1-65) · to_bar 999 is outside the score (bars 1-65) · and 2 more',
    ]);
  });

  it('still says the attempt was refused when it carries no reason', () => {
    expect(refusedLines({ refusals: [[]] })).toEqual(['attempt 1 refused: it did not pass the check']);
  });
});
