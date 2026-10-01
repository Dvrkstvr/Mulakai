import { describe, it, expect } from 'vitest';
import { shouldAutoRead, type AutoReadFacts } from './autoReadLyrics';

const base: AutoReadFacts = { source: 'upload', lyricsOpen: true, readerReady: true, sourceKey: 'upload:a.mp3:1:2', readSourceKey: null };

describe('shouldAutoRead', () => {
  it('reads an upload whose LYRICS hold none of the user words', () => {
    expect(shouldAutoRead(base)).toBe(true);
  });

  it('leaves a library song to its own words', () => {
    expect(shouldAutoRead({ ...base, source: 'library', sourceKey: 'library:s1' })).toBe(false);
  });

  it('never touches LYRICS that hold the user words', () => {
    expect(shouldAutoRead({ ...base, lyricsOpen: false })).toBe(false);
  });

  it('waits for a lyrics reader that answers', () => {
    expect(shouldAutoRead({ ...base, readerReady: false })).toBe(false);
  });

  it('does not read a source twice, but reads a new one', () => {
    expect(shouldAutoRead({ ...base, readSourceKey: base.sourceKey })).toBe(false);
    expect(shouldAutoRead({ ...base, readSourceKey: 'upload:old.mp3:1:2' })).toBe(true);
  });

  it('needs a picked source', () => {
    expect(shouldAutoRead({ ...base, sourceKey: null })).toBe(false);
  });
});
