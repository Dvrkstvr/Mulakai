/** The chat store against a mocked server: open and rehydrate, SEND → poll → reply (with the draft's marks), a
 * refused POST resent with the same key, CANCEL, a lost job, ASSISTANT OFF, and CREATE SONG's take. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ChatCreateStart, ChatDraft, ChatMessageView, ChatStatus, ChatThreadView, ChatTurnStart } from './api/chat';
import type { TurnJobPoll } from './chatTurn';

type Poll = TurnJobPoll & { error?: string };
const { ApiError } = await vi.importActual<typeof import('./api/http')>('./api/http');
const jobStatus = vi.fn<(id: string) => Promise<Poll>>();
vi.mock('./api', () => ({ ApiError, api: { jobStatus: (id: string) => jobStatus(id) } }));
const chatApi = {
  chatStatus: vi.fn<() => Promise<ChatStatus>>(),
  chatDraftThread: vi.fn<() => Promise<ChatThreadView>>(),
  resetChatDraft: vi.fn<() => Promise<ChatThreadView>>(),
  chatThread: vi.fn<(id: string) => Promise<ChatThreadView>>(),
  songChatThread: vi.fn<(id: string) => Promise<ChatThreadView>>(),
  putChatDraft: vi.fn(),
  startChatTurn: vi.fn<(id: string, text: string, key: string) => Promise<ChatTurnStart>>(),
  cancelChatJob: vi.fn<(id: string) => Promise<unknown>>(),
  createChatSong: vi.fn<(id: string, proposalId: string) => Promise<ChatCreateStart>>(),
};
vi.mock('./api/chat', () => ({ chatApi }));

const { useChatStore } = await import('./chatStore');
const { useChatDraftStore, fieldMark } = await import('./chatDraftStore');
const { POLL_MS } = await import('./transcribeStore');

const draft = (rev: number, bpm = 68): ChatDraft => ({
  draft_v: 1, rev, touched: {},
  fields: { title: null, style: 'ballad', bpm, key: null, timeSignature: null, language: null, structure: [], lyrics: [], engine: 'yue2' },
});
const msg = (over: Partial<ChatMessageView>): ChatMessageView => ({
  id: 'u1', seq: 1, role: 'user', kind: 'text', text: 'a slow ballad', body: null, proposalId: null, jobId: 'j1', versionId: null,
  state: 'done', createdAt: '', ...over,
});
const thread = (messages: ChatMessageView[] = [], d = draft(1)): ChatThreadView => ({ id: 't1', songId: null, draft: d, blockers: [], messages });
const recipe = msg({ id: 'a1', seq: 2, role: 'assistant', kind: 'recipe', state: 'pending', proposalId: 'p1', jobId: null,
  body: { chat_v: 1, recipe: {} as never, assumptions: [], changed: ['bpm'], skipped: [] } });
const store = () => useChatStore.getState();
const tick = () => vi.advanceTimersByTimeAsync(POLL_MS);

beforeEach(async () => {
  vi.useFakeTimers();
  useChatStore.setState({ status: { configured: true, assistant: 'ok' }, thread: null, commit: null });
  useChatDraftStore.getState().clear();
  chatApi.chatDraftThread.mockResolvedValue(thread());
  chatApi.cancelChatJob.mockResolvedValue({ ok: true });
  await store().openDraft();
});
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('chatStore', () => {
  it('opens the draft thread and hands its draft to the one draft store', () => {
    expect(store().thread?.id).toBe('t1');
    expect(useChatDraftStore.getState().draft?.rev).toBe(1);
  });

  it('SEND → queued → thinking attempt 2 → the reply: outcome, and the filled field reads ASSISTANT', async () => {
    chatApi.startChatTurn.mockResolvedValue({ jobId: 'j1', messageId: 'u1', position: 1 });
    chatApi.chatThread.mockResolvedValue(thread([msg({ state: 'queued' })]));
    store().type('a slow ballad');
    await store().send();
    expect(chatApi.startChatTurn).toHaveBeenCalledWith('t1', 'a slow ballad', expect.any(String));
    expect(store().turn).toMatchObject({ phase: { kind: 'queued', ahead: 1 }, text: '' });
    jobStatus.mockResolvedValueOnce({ status: 'running', progressText: 'attempt 2 of 3 · bad key' });
    await tick();
    expect(store().turn.phase).toEqual({ kind: 'thinking', attempt: 2, note: 'bad key' });
    jobStatus.mockResolvedValueOnce({ status: 'done' });
    chatApi.chatThread.mockResolvedValue(thread([msg({}), recipe], draft(2, 60)));
    await tick();
    expect(store().turn.phase).toEqual({ kind: 'outcome', replyId: 'a1' });
    expect(fieldMark(useChatDraftStore.getState(), 'bpm')).toBe('assistant');
    expect(useChatDraftStore.getState().filled.bpm).toEqual({ old: 68 });
  });

  it('no SEND while the assistant is off (F-043)', async () => {
    useChatStore.setState({ status: { configured: true, assistant: 'off', cause: 'Ollama did not answer' } });
    store().type('hi');
    await store().send();
    expect(chatApi.startChatTurn).not.toHaveBeenCalled();
  });

  it('a refused POST keeps the text; the resend carries the same clientKey (one turn on the server)', async () => {
    chatApi.startChatTurn.mockRejectedValueOnce(new Error('the queue is full'));
    store().type('hi');
    await store().send();
    expect(store().turn).toMatchObject({ phase: { kind: 'composing' }, text: 'hi', error: 'the queue is full' });
    chatApi.startChatTurn.mockResolvedValueOnce({ jobId: 'j1', messageId: 'u1', position: 0 });
    chatApi.chatThread.mockResolvedValue(thread([msg({ state: 'thinking' })]));
    await store().send();
    expect(chatApi.startChatTurn.mock.calls[1][2]).toBe(chatApi.startChatTurn.mock.calls[0][2]);
  });

  it('CANCEL while thinking asks the server, and the settled thread says CANCELLED', async () => {
    chatApi.startChatTurn.mockResolvedValue({ jobId: 'j1', messageId: 'u1', position: 0 });
    chatApi.chatThread.mockResolvedValue(thread([msg({ state: 'thinking' })]));
    store().type('hi');
    await store().send();
    await store().cancel();
    expect(chatApi.cancelChatJob).toHaveBeenCalledWith('j1');
    expect(store().turn.cancelling).toBe(true);
    jobStatus.mockResolvedValueOnce({ status: 'failed', cancelled: true });
    chatApi.chatThread.mockResolvedValue(thread([msg({ state: 'cancelled' })]));
    await tick();
    expect(store().turn).toMatchObject({ phase: { kind: 'cancelled' }, cancelling: false });
  });

  it('a reload mid-turn resumes the poll; a job gone (404) settles as the thread says: interrupted', async () => {
    chatApi.chatDraftThread.mockResolvedValue(thread([msg({ state: 'thinking' })]));
    await store().openDraft();
    expect(store().turn.phase).toMatchObject({ kind: 'thinking' });
    jobStatus.mockRejectedValueOnce(new ApiError('gone', 404));
    chatApi.chatThread.mockResolvedValue(thread([msg({ state: 'interrupted' })]));
    await tick();
    expect(store().turn.phase).toEqual({ kind: 'interrupted' });
  });

  it('a turn the planner could not answer reads offline, with RETRY', async () => {
    const failed = msg({ id: 'a1', role: 'assistant', kind: 'failed', state: null, body: { chat_v: 1, cause: 'offline', reasons: ['Ollama did not answer'] } });
    chatApi.chatDraftThread.mockResolvedValue(thread([msg({ state: 'failed' }), failed]));
    await store().openDraft();
    expect(store().turn.phase).toEqual({ kind: 'offline', cause: 'Ollama did not answer' });
    chatApi.startChatTurn.mockResolvedValue({ jobId: 'j2', messageId: 'u2', position: 0 });
    chatApi.chatThread.mockResolvedValue(thread([msg({ id: 'u2', state: 'thinking' })]));
    await store().retry();
    expect(chatApi.startChatTurn).toHaveBeenCalledWith('t1', 'a slow ballad', expect.any(String));
  });

  it('CREATE SONG flushes the draft, starts the take, follows it, and reads the thread when it lands', async () => {
    chatApi.createChatSong.mockResolvedValue({ jobId: 'g1' });
    chatApi.chatThread.mockResolvedValue(thread([msg({}), recipe]));
    await store().create('p1');
    expect(chatApi.createChatSong).toHaveBeenCalledWith('t1', 'p1');
    expect(store().commit).toMatchObject({ jobId: 'g1', phase: { kind: 'queued' } });
    jobStatus.mockResolvedValueOnce({ status: 'running', progressText: 'stage 1 41%' });
    await tick();
    expect(store().commit?.phase).toEqual({ kind: 'running', progressText: 'stage 1 41%' });
    jobStatus.mockResolvedValueOnce({ status: 'done' });
    chatApi.chatThread.mockResolvedValue({ ...thread([msg({}), recipe]), songId: 's1' });
    await tick();
    expect(store().commit).toBeNull();
    expect(store().thread?.songId).toBe('s1');
  });

  it('CREATE SONG refused by the server\'s re-check names why and starts nothing', async () => {
    chatApi.createChatSong.mockResolvedValue({ refused: 'this proposal expired, ask again' });
    await store().create('p1');
    expect(store().commit?.phase).toEqual({ kind: 'failed', error: 'this proposal expired, ask again' });
    expect(jobStatus).not.toHaveBeenCalled();
  });

  it('a reload with a card committing follows its take again', async () => {
    chatApi.chatDraftThread.mockResolvedValue(thread([msg({}), { ...recipe, state: 'committing', jobId: 'g1' }]));
    await store().openDraft();
    expect(store().commit).toMatchObject({ proposalId: 'p1', jobId: 'g1', phase: { kind: 'running' } });
  });

  it('NEW CHAT resets the draft thread on the server and starts composing afresh', async () => {
    chatApi.resetChatDraft.mockResolvedValue({ ...thread(), id: 't2' });
    store().type('half a thought');
    await store().newChat();
    expect(store().thread?.id).toBe('t2');
    expect(store().turn.phase).toEqual({ kind: 'composing' });
  });

  it('NEW CHAT refused (409, a take still runs): the thread stays and the reason is shown', async () => {
    chatApi.chatDraftThread.mockResolvedValue(thread([msg({})]));
    await store().openDraft();
    chatApi.resetChatDraft.mockRejectedValue(new Error('CANCEL it first'));
    await store().newChat();
    expect(store().thread?.id).toBe('t1');
    expect(store().refusal).toBe('CANCEL it first');
  });

  it('a reload mid-turn reads the queue place from the message job view at once', async () => {
    chatApi.chatDraftThread.mockResolvedValue(thread([msg({ state: 'queued', jobId: 'j1', job: { status: 'queued', queuePosition: 2 } })]));
    await store().openDraft();
    expect(store().turn.phase).toEqual({ kind: 'queued', ahead: 2 });
  });
});
