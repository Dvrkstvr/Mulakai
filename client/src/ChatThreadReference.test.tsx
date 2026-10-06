/** C3 in the thread and the composer (F-061, D-129, D-130): the attach chip and ATTACH ▾, SEND held by an upload or
 * a reading, the analyze and reading cards in the thread, the ◉ mark on a message that carried a reference. */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessageView, ChatThreadView } from './api/chat';
import type { ReferenceView } from './api/chatReferences';
import { useChatAttachStore } from './chatAttachStore';
import { ChatComposer } from './ChatComposer';
import { INITIAL_READING } from './chatReading';
import { useChatStore } from './chatStore';
import { ChatThread } from './ChatThread';
import { INITIAL_TURN } from './chatTurn';

vi.mock('zustand', () => import('./zustandServerSnapshot'));

const REF = { id: 'r1', origin: 'upload', name: 'slow_dance_demo.mp3', seconds: 192, layers: null } as ReferenceView;
const USER: ChatMessageView = {
  id: 'u1', seq: 1, role: 'user', kind: 'text', text: 'like this, but in German', body: { chat_v: 1, sentRev: 1, attach: { referenceId: 'r1' } },
  proposalId: null, jobId: 'j1', versionId: null, state: 'done', createdAt: '',
};
const ANALYZE: ChatMessageView = {
  id: 'a1', seq: 2, role: 'assistant', kind: 'analyze', text: 'I will read it first.', proposalId: 'p1', jobId: null, versionId: null, state: 'done', createdAt: '',
  body: { chat_v: 1, target: { referenceId: 'r1' }, name: 'slow_dance_demo.mp3', seconds: 192, readTo: 192, cut: false, estimate: { words: 1, score: 1, caption: 1, total: 3 } },
};
const READING: ChatMessageView = {
  id: 'c1', seq: 3, role: 'assistant', kind: 'reading', text: '', proposalId: null, jobId: 'j2', versionId: null, state: 'reading', createdAt: '',
  body: { chat_v: 1, referenceId: 'r1', name: 'slow_dance_demo.mp3', followUp: true, reading: null },
};

function setup(messages: ChatMessageView[], songId: string | null = null) {
  const thread = { id: 't1', songId, draft: { draft_v: 1, rev: 1, fields: {}, touched: {} }, blockers: [], messages, references: [REF] } as unknown as ChatThreadView;
  useChatStore.setState({
    status: { configured: true, assistant: 'ok' }, thread, turn: { ...INITIAL_TURN, text: 'hello' }, commit: null, error: null,
    reading: {
      cards: {
        a1: { phase: { kind: 'done', partial: false }, jobId: null, stage: null },
        c1: { phase: { kind: 'reading', step: 2, name: 'SCORE', note: null }, jobId: 'j2', stage: 'read' },
      },
    },
  });
}
const composer = () => renderToStaticMarkup(
  <ChatComposer turn={useChatStore.getState().turn} assistantOn committing={false} onType={vi.fn()} onSend={vi.fn()} />,
);

afterEach(() => {
  useChatStore.setState({ thread: null, status: null, turn: INITIAL_TURN, reading: INITIAL_READING });
  useChatAttachStore.setState({ byThread: {} });
});

describe('the thread with a reference', () => {
  it('the sent message keeps a ◉ mark with the name; the analyze card, then the reading card', () => {
    setup([USER, ANALYZE, READING]);
    const out = renderToStaticMarkup(<ChatThread songTitle="" onForm={vi.fn()} onLibrary={vi.fn()} />);
    expect(out).toContain('◉ slow_dance_demo.mp3');
    expect(out).toContain('I will read it first.');
    expect(out.indexOf('THE READING IS BELOW')).toBeLessThan(out.indexOf('READING · 2 OF 3 · SCORE'));
  });
});

describe('the composer with C3', () => {
  it('ATTACH ▾ sits left of the field on the draft thread', () => {
    setup([]);
    useChatStore.setState({ reading: INITIAL_READING });
    const out = composer();
    expect(out.indexOf('ATTACH ▾')).toBeLessThan(out.indexOf('chat-input'));
    expect(out).not.toMatch(/class="chat-send" disabled/);
  });
  it('the chip above the field; SEND waits while it uploads', () => {
    setup([]);
    useChatStore.setState({ reading: INITIAL_READING });
    useChatAttachStore.setState({ byThread: { t1: { phase: 'uploading', name: 'a.mp3', progress: 0.5 } } });
    const out = composer();
    expect(out).toContain('UPLOADING 50%');
    expect(out).toMatch(/class="chat-send" disabled=""/);
    expect(out).toContain('SEND waits for the upload');
  });
  it('SEND waits from READ until the follow-up turn settles (D-129)', () => {
    setup([USER, ANALYZE, READING]);
    const out = composer();
    expect(out).toMatch(/class="chat-send" disabled=""/);
    expect(out).toContain('SEND waits for the reading and its proposal');
  });
  it('a song thread: ATTACH ▾ greyed (D-130)', () => {
    setup([], 'song-1');
    useChatStore.setState({ reading: INITIAL_READING });
    expect(composer()).toMatch(/chat-attach-btn"[^>]*disabled=""/);
  });
});
