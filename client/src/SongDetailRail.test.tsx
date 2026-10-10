/** The Library side panel opens the song either way: OPEN IN EDITOR always, OPEN CHAT when the chat is on. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Song } from './api';
import { SongDetailRail } from './SongDetailRail';

const song = { id: 's1', title: 'Heavy Field VI', caption: 'metal', lyrics: '', bpm: 170, key_scale: 'E minor', duration: 204, folder_id: null } as unknown as Song;
const noop = () => {};

describe('SongDetailRail', () => {
  it('offers OPEN IN EDITOR', () => {
    const html = renderToStaticMarkup(
      <SongDetailRail song={song} folders={[]} onClose={noop} onReusePrompt={noop} onCreateCover={noop} onRenamed={noop} />,
    );
    expect(html).toContain('OPEN IN EDITOR');
  });
});
