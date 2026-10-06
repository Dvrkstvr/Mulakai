/** The song panel's reference, the sidebar that shows it, and the player's A/B pill (F-062; chat-reference.html 4a). */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatThreadView } from './api/chat';
import type { ReferenceView } from './api/chatReferences';
import { useChatStore } from './chatStore';
import { ChatPlayer } from './ChatPlayer';
import { ChatReferencePanel } from './ChatReferencePanel';
import { ChatSidebar } from './ChatSidebar';
import { useChatAb } from './useChatPlayback';

vi.mock('zustand', () => import('./zustandServerSnapshot'));

const REF: ReferenceView = {
  id: 'ref1', origin: 'upload', name: 'slow_dance_demo.mp3', sourceSongId: null, url: '/audio/references/ref1.mp3', seconds: 192,
  readTo: 192, cut: false, layers: null, readAt: '2026-10-07T10:00:00Z', readingNote: null, createdAt: '2026-10-07T09:58:00Z',
};
const panel = (refs: ReferenceView[], side: 'song' | 'reference' = 'song') => renderToStaticMarkup(
  <ChatReferencePanel references={refs} side={side} onAb={vi.fn()} onReanalyze={vi.fn()} />,
);
const thread = (songId: string | null, references: ReferenceView[] = [REF]) =>
  ({ id: 't1', songId, draft: { draft_v: 1, rev: 1, fields: {}, touched: {} }, blockers: [], messages: [], references }) as unknown as ChatThreadView;

afterEach(() => { useChatStore.setState({ thread: null }); useChatAb.getState().reset(); });

describe('ChatReferencePanel', () => {
  it('names the reference, its length and read date, the rights line, RE-ANALYZE with its consequence, and A/B', () => {
    const out = panel([REF]);
    expect(out).toContain('REFERENCE');
    expect(out).toContain('slow_dance_demo.mp3');
    expect(out).toContain('3:12 · read 2026-10-07 · upload');
    expect(out).toContain('Stays on this machine. You are responsible for the rights to this recording.');
    expect(out).toMatch(/class="chat-q"[^>]*><span>RE-ANALYZE/);
    expect(out).toContain('Reads the reference again · uses the GPU · a new reading card lands in this chat · nothing else changes');
    expect(out).toMatch(/class="chat-ab"[^>]*aria-pressed="false"[^>]*><span>A\/B/);
  });
  it('while the reference plays, its A/B is pressed (lilac fill)', () => {
    expect(panel([REF], 'reference')).toMatch(/class="chat-ab on"[^>]*aria-pressed="true"/);
  });
  it('a stored reading that cannot be read says so in rust; never read says not read yet', () => {
    const out = panel([{ ...REF, readAt: null, readingNote: 'not read: read again' }]);
    expect(out).toContain('3:12 · not read yet · upload');
    expect(out).toMatch(/chat-fd-problem">not read: read again/);
  });
  it('a library pick says so', () => {
    expect(panel([{ ...REF, origin: 'library', name: 'Long Way Down' }])).toContain('· library');
  });
});

describe('ChatSidebar with a song\'s reference', () => {
  const side = () => renderToStaticMarkup(<ChatSidebar head="SONG" foot="" filled={0}><i /></ChatSidebar>);
  it('a song thread lists its reference under the versions', () => {
    useChatStore.setState({ thread: thread('s1') });
    expect(side()).toContain('slow_dance_demo.mp3');
  });
  it('the draft thread does not (the chip and the cards hold it there)', () => {
    useChatStore.setState({ thread: thread(null) });
    expect(side()).not.toContain('slow_dance_demo.mp3');
  });
});

describe('ChatPlayer A/B pill', () => {
  const player = () => renderToStaticMarkup(<ChatPlayer file="take.wav" title="Die Tür" number={1} label={null} />);
  it('a song with a reference: REFERENCE ⇄ SONG, on the song', () => {
    useChatStore.setState({ thread: thread('s1') });
    const out = player();
    expect(out).toMatch(/class="chat-ab"[^>]*aria-pressed="false"[^>]*><span>REFERENCE ⇄ SONG/);
    expect(out).not.toContain('LISTENING');
  });
  it('on the reference: pressed, and says it plays the reference at the same seconds', () => {
    useChatStore.setState({ thread: thread('s1') });
    useChatAb.getState().toggle();
    const out = player();
    expect(out).toMatch(/class="chat-ab on"[^>]*aria-pressed="true"/);
    expect(out).toContain('LISTENING · SAME SECONDS');
    expect(out).not.toContain('Active version'); // the player is not playing v1 now
  });
  it('no reference: no pill', () => {
    useChatStore.setState({ thread: thread('s1', []) });
    expect(player()).not.toContain('chat-ab');
  });
});
