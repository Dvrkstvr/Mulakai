import { describe, expect, it } from 'vitest';
import { restoreDraft } from './lyricsDraftStore';

describe('restoreDraft', () => {
  it('a draft made against these lyrics comes back', () => {
    expect(restoreDraft({ base: 'old words', draft: 'my edit' }, 'old words')).toBe('my edit');
  });

  it('the song changed its words since (a kept repaint, a revert): the draft is dropped', () => {
    expect(restoreDraft({ base: 'old words', draft: 'my edit' }, 'new words')).toBe('new words');
    expect(restoreDraft(null, 'new words')).toBe('new words');
  });
});
