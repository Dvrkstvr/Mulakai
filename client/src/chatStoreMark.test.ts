/** The chat store's C1 half against a mocked server (F-055): SEND carries the mark and RETRY resends it; a stale mark
 * holds SEND; a 409 MARK_STALE refuses the turn, turns the mark stale and writes nothing. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ChatThreadView } from './api/chat';
import { MarkStaleError, type RangeMark } from './api/chatAnalysis';

const { ApiError } = await vi.importActual<typeof import('./api/http')>('./api/http');
vi.mock('./api', () => ({ ApiError, api: { jobStatus: vi.fn(async () => ({ status: 'queued', queuePosition: 1 })) } }));
const chatApi = {
  chatStatus: vi.fn(), chatDraftThread: vi.fn<() => Promise<ChatThreadView>>(), resetChatDraft: vi.fn(),
  chatThread: vi.fn<(id: string) => Promise<ChatThreadView>>(), songChatThread: vi.fn(), putChatDraft: vi.fn(),
  startChatTurn: vi.fn(), cancelChatJob: vi.fn(), createChatSong: vi.fn(),
};
vi.mock('./api/chat', () => ({ chatApi }));

const { useChatStore } = await import('./chatStore');
const { useChatMarkStore } = await import('./chatMarkStore');
const { useChatDraftStore } = await import('./chatDraftStore');

const MARK: RangeMark = { kind: 'range', versionId: 'v4', bars: [25, 34], seconds: [57.6, 81.6] };
const thread: ChatThreadView = {
  id: 't1', songId: 's1', blockers: [], messages: [],
  draft: { draft_v: 1, rev: 1, touched: {}, fields: { title: null, style: null, bpm: null, key: null, timeSignature: null, language: null, structure: [], lyrics: [], engine: 'yue2' } },
};
const store = () => useChatStore.getState();

beforeEach(async () => {
  vi.useFakeTimers();
  useChatStore.setState({ status: { configured: true, assistant: 'ok' }, thread: null, commit: null });
  useChatMarkStore.setState({ byThread: {} });
  useChatDraftStore.getState().clear();
  chatApi.songChatThread.mockResolvedValue(thread);
  chatApi.chatThread.mockResolvedValue(thread);
  await store().openSong('s1');
});
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('chatStore with a mark', () => {
  it('SEND carries the mark; RETRY after a cancel resends it', async () => {
    chatApi.startChatTurn.mockResolvedValue({ jobId: 'j1', messageId: 'u1', position: 1 });
    chatApi.cancelChatJob.mockResolvedValue({ ok: true });
    store().type('make this jazzier');
    await store().send(MARK);
    expect(chatApi.startChatTurn).toHaveBeenCalledWith('t1', 'make this jazzier', expect.any(String), null, MARK);
    useChatStore.setState({ turn: { ...store().turn, phase: { kind: 'cancelled' } } });
    await store().retry();
    expect(chatApi.startChatTurn).toHaveBeenLastCalledWith('t1', 'make this jazzier', expect.any(String), null, MARK);
  });

  it('with no mark the body has none (the whole song)', async () => {
    chatApi.startChatTurn.mockResolvedValue({ jobId: 'j1', messageId: 'u1', position: 0 });
    store().type('make it jazzier');
    await store().send();
    expect(chatApi.startChatTurn).toHaveBeenCalledWith('t1', 'make it jazzier', expect.any(String));
    expect(store().lastMark).toBeNull();
  });

  it('a stale mark holds SEND: nothing posted', async () => {
    useChatMarkStore.getState().set('t1', MARK);
    useChatMarkStore.getState().refused('t1', null);
    store().type('make this jazzier');
    await store().send(MARK);
    expect(chatApi.startChatTurn).not.toHaveBeenCalled();
  });

  it('409 MARK_STALE: the turn is refused with the reason, the mark turns stale with USE BARS, SEND is held', async () => {
    useChatMarkStore.getState().set('t1', MARK);
    chatApi.startChatTurn.mockRejectedValue(new MarkStaleError({
      error: 'MARK_STALE', reason: 'your mark was on v4; v5 moved those bars', was: MARK, shift: { atBar: 17, delta: 8 },
    }));
    store().type('make this jazzier');
    await store().send(MARK);
    expect(store().turn).toMatchObject({ phase: { kind: 'composing' }, error: 'your mark was on v4; v5 moved those bars' });
    expect(useChatMarkStore.getState().byThread.t1.stale).toEqual({ useBars: [33, 42] });
    chatApi.startChatTurn.mockClear();
    await store().send(MARK);
    expect(chatApi.startChatTurn).not.toHaveBeenCalled();
  });
});
