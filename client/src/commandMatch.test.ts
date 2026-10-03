import { describe, it, expect } from 'vitest';
import { matchScore } from './commandMatch';

describe('matchScore', () => {
  it('matches a case-insensitive subsequence', () => {
    expect(matchScore('cpsky', 'Copper Sky')).not.toBeNull();
    expect(matchScore('COPPER', 'copper sky')).not.toBeNull();
    expect(matchScore('add vocal', 'Add layer · vocals')).not.toBeNull();
  });

  it('rejects text that lacks the characters in order', () => {
    expect(matchScore('xyz', 'Copper Sky')).toBeNull();
    expect(matchScore('ykc', 'Copper Sky')).toBeNull();
  });

  it('matches everything on an empty query, with no score', () => {
    expect(matchScore('', 'anything')).toBe(0);
    expect(matchScore('   ', 'anything')).toBe(0);
  });

  it('ranks word starts above the same letters mid-word', () => {
    const wordStarts = matchScore('sv', 'Split vocals')!;
    const midWord = matchScore('sv', 'Lessvox')!;
    expect(wordStarts).toBeGreaterThan(midWord);
  });

  it('prefers a later word-start occurrence over an earlier mid-word one', () => {
    // 'v' first appears inside "Revert"; the word start in "vocals" should still win.
    expect(matchScore('v', 'Revert vocals')).toBe(matchScore('v', 'vocals'));
  });

  it('ranks a contiguous run above scattered letters', () => {
    expect(matchScore('oca', 'vocals')!).toBeGreaterThan(matchScore('oca', 'xoxcxa')!);
  });

  it('falls back when preferring word starts would strand later characters', () => {
    // Jumping to "Ab"'s word-start 'a' leaves no 'c' after it; plain greedy still matches.
    expect(matchScore('ac', 'xac Ab')).not.toBeNull();
  });
});
