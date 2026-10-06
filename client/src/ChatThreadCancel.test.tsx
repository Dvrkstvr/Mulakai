/** A reading card's CANCEL goes to the chat's cancel route (/api/chat/jobs/:id/cancel) for both stages: the
 * queue-only /api/generate route cannot stop a running reading and never clears the thread's live reading. */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessageView, ChatThreadView } from './api/chat';
import type { CardState } from './chatReading';
import { INITIAL_READING } from './chatReading';
import { useChatStore } from './chatStore';
import { ChatThread } from './ChatThread';
import { INITIAL_TURN } from './chatTurn';

vi.mock('zustand', () => import('./zustandServerSnapshot'));
const calls = vi.hoisted(() => ({ chat: [] as string[], generate: [] as string[], onCancel: null as null | ((c: CardState) => void) }));
vi.mock('./api/chat', async (orig) => {
  const mod = await orig<typeof import('./api/chat')>();
  return { ...mod, chatApi: { ...mod.chatApi, cancelChatJob: (id: string) => { calls.chat.push(id); return Promise.resolve({ ok: true }); } } };
});
vi.mock('./api', async (orig) => {
  const mod = await orig<typeof import('./api')>();
  return { ...mod, api: { ...mod.api, cancelJob: (id: string) => { calls.generate.push(id); return Promise.resolve({}); } } };
});
vi.mock('./ChatReadingCard', () => ({
  ChatReadingCard: (p: { onCancel: (c: CardState) => void }) => { calls.onCancel = p.onCancel; return null; },
}));

const READING: ChatMessageView = {
  id: 'c1', seq: 1, role: 'assistant', kind: 'reading', text: '', proposalId: null, jobId: 'j2', versionId: null, state: 'reading', createdAt: '',
  body: { chat_v: 1, referenceId: 'r1', name: 'a.mp3', followUp: true, reading: null },
};

beforeEach(() => {
  calls.chat = []; calls.generate = []; calls.onCancel = null;
  const thread = { id: 't1', songId: null, draft: { draft_v: 1, rev: 1, fields: {}, touched: {} }, blockers: [], messages: [READING], references: [] } as unknown as ChatThreadView;
  useChatStore.setState({ status: { configured: true, assistant: 'ok' }, thread, turn: INITIAL_TURN, commit: null, error: null, reading: INITIAL_READING });
  renderToStaticMarkup(<ChatThread songTitle="" onForm={vi.fn()} onLibrary={vi.fn()} />);
});
afterEach(() => useChatStore.setState({ thread: null, status: null, turn: INITIAL_TURN, reading: INITIAL_READING }));

describe('cancelCard', () => {
  it('a running reading: the chat cancel route, never the queue-only one', () => {
    calls.onCancel!({ phase: { kind: 'reading', step: 2, name: 'SCORE', note: null }, jobId: 'j2', stage: 'read' });
    expect(calls.chat).toEqual(['j2']);
    expect(calls.generate).toEqual([]);
  });
  it('a queued reading: the chat cancel route too (it clears the live reading)', () => {
    calls.onCancel!({ phase: { kind: 'queued', ahead: 1 }, jobId: 'j2', stage: 'read' });
    expect(calls.chat).toEqual(['j2']);
    expect(calls.generate).toEqual([]);
  });
  it('the follow-up turn: the chat cancel route', () => {
    calls.onCancel!({ phase: { kind: 'proposing' }, jobId: 'j3', stage: 'followUp' });
    expect(calls.chat).toEqual(['j3']);
  });
});
