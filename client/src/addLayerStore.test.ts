/** Add Layer's lyrics draft belongs to one song: another song's dock starts empty, the same song keeps it. */
import { beforeEach, describe, expect, it } from 'vitest';
import { useAddLayerDraft } from './addLayerStore';

describe('useAddLayerDraft', () => {
  beforeEach(() => { useAddLayerDraft.setState({ songId: null, lyrics: '' }); });

  it("another song's dock starts with no lyrics", () => {
    const d = useAddLayerDraft.getState();
    d.openSong('a');
    d.setLyrics('words for song a');
    d.openSong('b');
    expect(useAddLayerDraft.getState()).toMatchObject({ songId: 'b', lyrics: '' });
  });

  it('coming back to the same song keeps them', () => {
    const d = useAddLayerDraft.getState();
    d.openSong('a');
    d.setLyrics('words for song a');
    d.openSong('a');
    expect(useAddLayerDraft.getState().lyrics).toBe('words for song a');
  });
});
