/** The ways into CHAT (D-099, F-043, F-045): CHAT ⇄ LIBRARY in the header and OPEN CHAT on a song, shown only
 * while the chat is configured, so the golden path (LLM_API_URL empty) sees neither. */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Song } from './api';
import { useChatStore } from './chatStore';
import { Header } from './Header';
import { NavigationContext } from './Navigation';
import { SongDetailRail } from './SongDetailRail';

vi.mock('zustand', () => import('./zustandServerSnapshot'));

const SONG = { id: 's1', title: 'Luz', caption: '', lyrics: '', bpm: null, key_scale: '', time_signature: '', duration: 192, favorite: 0, audio_file: 'a.wav', trashed_at: null, created_at: '', comment: '', genre: '', album: '', cover_art_file: null, folder_id: null, reference_audio_label: null, reference_audio_influence: null, reference_style_influence: null, gen_task: 'text2music', engine: 'yue2' } as Song;
const rail = () => renderToStaticMarkup(
  <NavigationContext.Provider value={{ goToSettings: vi.fn(), openEditor: vi.fn(), openChat: vi.fn() }}>
    <SongDetailRail song={SONG} folders={[]} onClose={vi.fn()} onReusePrompt={vi.fn()} onCreateCover={vi.fn()} onRenamed={vi.fn()} />
  </NavigationContext.Provider>,
);

afterEach(() => useChatStore.setState({ status: null }));

describe('chat entry points', () => {
  it('header: CHAT and LIBRARY, the open one in acid outline', () => {
    const out = renderToStaticMarkup(<Header left={null} right={null} views={{ active: 'chat', onChat: vi.fn(), onLibrary: vi.fn() }} />);
    expect(out).toMatch(/class="header-view on" aria-current="page"><span>CHAT/);
    expect(out).toMatch(/class="header-view"><span>LIBRARY/);
  });
  it('header without the chat: no view switch at all', () => {
    expect(renderToStaticMarkup(<Header left={null} right={null} views={null} />)).not.toContain('header-view');
  });
  it('OPEN CHAT on a song only while the chat is configured', () => {
    expect(rail()).not.toContain('OPEN CHAT');
    useChatStore.setState({ status: { configured: false, assistant: 'off' } });
    expect(rail()).not.toContain('OPEN CHAT');
    useChatStore.setState({ status: { configured: true, assistant: 'ok' } });
    expect(rail()).toContain('OPEN CHAT');
  });
});
