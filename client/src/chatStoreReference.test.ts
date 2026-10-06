/** The chat store's C3 half against a mocked server (F-061, F-062, D-129): SEND carries the attached reference, READ
 * follows the reading job then the follow-up turn (SEND off until it settles, the reply's fields marked), a refused
 * READ, a reload mid-reading, and RE-ANALYZE. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ChatDraft, ChatMessageView, ChatThreadView } from './api/chat';
import type { ReadingView, ReadStart } from './api/chatReferences';

const { ApiError } = await vi.importActual<typeof import('./api/http')>('./api/http');
const { isNotRead } = await vi.importActual<typeof import('./api/chatReferences')>('./api/chatReferences');
const jobStatus = vi.fn<(id: string) => Promise<Record<string, unknown>>>();
vi.mock('./api', () => ({ ApiError, api: { jobStatus: (id: string) => jobStatus(id) } }));
const chatApi = {
  chatStatus: vi.fn(), chatDraftThread: vi.fn<() => Promise<ChatThreadView>>(), resetChatDraft: vi.fn(),
  chatThread: vi.fn<(id: string) => Promise<ChatThreadView>>(), songChatThread: vi.fn(), putChatDraft: vi.fn(),
  startChatTurn: vi.fn(), cancelChatJob: vi.fn(), createChatSong: vi.fn(),
};
vi.mock('./api/chat', () => ({ chatApi }));
const chatReferencesApi = {
  uploadReference: vi.fn(), pickLibraryReference: vi.fn(),
  readReference: vi.fn<(threadId: string, proposalId: string) => Promise<ReadStart>>(),
  rereadReference: vi.fn<(referenceId: string) => Promise<ReadStart>>(),
};
vi.mock('./api/chatReferences', () => ({ chatReferencesApi, isNotRead }));

const { useChatStore } = await import('./chatStore');
const { useChatAttachStore } = await import('./chatAttachStore');
const { useChatDraftStore, fieldMark } = await import('./chatDraftStore');
const { POLL_MS } = await import('./transcribeStore');

const draft = (rev: number, bpm: number | null = null): ChatDraft => ({
  draft_v: 1, rev, touched: {},
  fields: { title: null, style: null, bpm, key: null, timeSignature: null, language: null, structure: [], lyrics: [], engine: 'yue2' },
});
const READ: ReadingView = {
  reading_v: 1, readAt: '', seconds: 190, readTo: 190, cut: false, plan: { words: 'service', score: 'service', caption: 'service' },
  words: { language: 'en', lines: [], instrumental: true }, score: { abc: 'X:1', source: 'transcribed', chords: true, facts: null, warnings: [], measure: null },
  caption: { caption: 'piano', bpm: 70, key: 'Am', meter: '4/4' },
};
const base: Omit<ChatMessageView, 'id' | 'kind'> = { seq: 1, role: 'assistant', text: '', body: null, proposalId: null, jobId: null, versionId: null, state: null, createdAt: '' };
const user: ChatMessageView = { ...base, id: 'u1', role: 'user', kind: 'text', text: 'like this, but in German', jobId: 'j1', state: 'done' };
const analyze = (state: ChatMessageView['state']): ChatMessageView => ({ ...base, id: 'a1', kind: 'analyze', proposalId: 'p1', state });
const card = (state: ChatMessageView['state'], jobId: string, reading: ReadingView | null = null, job?: ChatMessageView['job']): ChatMessageView =>
  ({ ...base, id: 'c1', kind: 'reading', jobId, state, job, body: { chat_v: 1, referenceId: 'r1', name: 'demo.mp3', reading, followUp: true } });
const recipe: ChatMessageView = { ...base, id: 'x1', kind: 'recipe', state: 'pending', proposalId: 'p2',
  body: { chat_v: 1, recipe: {} as never, assumptions: [], changed: ['bpm'], skipped: [] } };
const thread = (messages: ChatMessageView[], d = draft(1)): ChatThreadView => ({ id: 't1', songId: null, draft: d, blockers: [], messages });
const store = () => useChatStore.getState();
const tick = () => vi.advanceTimersByTimeAsync(POLL_MS);
const phase = () => store().reading.cards.c1?.phase;

beforeEach(async () => {
  vi.useFakeTimers();
  useChatStore.setState({ status: { configured: true, assistant: 'ok' }, thread: null, commit: null });
  useChatAttachStore.setState({ byThread: {} });
  useChatDraftStore.getState().clear();
  chatApi.chatDraftThread.mockResolvedValue(thread([user, analyze('pending')]));
  await store().openDraft();
});
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('chatStore · references', () => {
  it('SEND carries the attached reference and clears the chip; an upload in flight holds SEND', async () => {
    useChatAttachStore.setState({ byThread: { t1: { phase: 'uploading', name: 'demo.mp3', progress: 0.2 } } });
    store().type('like this, but in German');
    await store().send();
    expect(chatApi.startChatTurn).not.toHaveBeenCalled();
    useChatAttachStore.setState({ byThread: { t1: { phase: 'attached', name: 'demo.mp3', referenceId: 'r1', seconds: 190 } } });
    chatApi.startChatTurn.mockResolvedValue({ jobId: 'j2', messageId: 'u2', position: 0 });
    chatApi.chatThread.mockResolvedValue(thread([user]));
    await store().send();
    expect(chatApi.startChatTurn).toHaveBeenCalledWith('t1', 'like this, but in German', expect.any(String), { referenceId: 'r1' });
    expect(useChatAttachStore.getState().byThread.t1).toBeUndefined();
  });

  it('READ → the reading job\'s steps → PROPOSING… (SEND off) → the reply lands with its fields marked, SEND back on', async () => {
    chatReferencesApi.readReference.mockResolvedValue({ jobId: 'rj1' });
    chatApi.chatThread.mockResolvedValue(thread([user, analyze('done'), card('queued', 'rj1', null, { status: 'queued', queuePosition: 1 })]));
    await store().read('p1');
    expect(chatReferencesApi.readReference).toHaveBeenCalledWith('t1', 'p1');
    expect(store().reading.cards.a1.phase.kind).toBe('done');
    expect(phase()).toEqual({ kind: 'queued', ahead: 1 });
    jobStatus.mockResolvedValueOnce({ status: 'running', progressText: 'SCORE · transcribing' });
    await tick();
    expect(phase()).toMatchObject({ kind: 'reading', step: 2 });
    jobStatus.mockResolvedValueOnce({ status: 'done' });
    chatApi.chatThread.mockResolvedValue(thread([user, analyze('done'), card('thinking', 'tj1', READ)]));
    await tick();
    expect(phase()).toEqual({ kind: 'proposing' });
    store().type('and slower');
    await store().send();
    expect(chatApi.startChatTurn).not.toHaveBeenCalled();
    jobStatus.mockResolvedValueOnce({ status: 'done' });
    chatApi.chatThread.mockResolvedValue(thread([user, analyze('done'), card('done', 'tj1', READ), recipe], draft(2, 70)));
    await tick();
    expect(phase()).toEqual({ kind: 'done', partial: false });
    expect(fieldMark(useChatDraftStore.getState(), 'bpm')).toBe('assistant');
    chatApi.startChatTurn.mockResolvedValue({ jobId: 'j3', messageId: 'u3', position: 0 });
    await store().send();
    expect(chatApi.startChatTurn).toHaveBeenCalled();
  });

  it('READ refused by the server\'s re-check names why on the card', async () => {
    chatReferencesApi.readReference.mockResolvedValue({ refused: 'a model is still loaded' });
    await store().read('p1');
    expect(store().reading.cards.a1.phase).toEqual({ kind: 'refused', reason: 'a model is still loaded' });
    expect(jobStatus).not.toHaveBeenCalled();
  });

  it('a reload mid-reading follows the card\'s job again; a job gone reads interrupted', async () => {
    chatApi.chatDraftThread.mockResolvedValue(thread([user, analyze('done'), card('reading', 'rj1', null, { status: 'running', progressText: 'WORDS' })]));
    await store().openDraft();
    expect(phase()).toMatchObject({ kind: 'reading', step: 1 });
    jobStatus.mockRejectedValueOnce(new ApiError('gone', 404));
    await tick();
    expect(phase()).toEqual({ kind: 'interrupted' });
  });

  it('RE-ANALYZE follows the new card; a refusal comes back as the reason', async () => {
    chatReferencesApi.rereadReference.mockResolvedValueOnce({ refused: 'a turn is open' });
    expect(await store().reanalyze('r1')).toBe('a turn is open');
    chatReferencesApi.rereadReference.mockResolvedValueOnce({ jobId: 'rj2' });
    chatApi.chatThread.mockResolvedValue(thread([user, card('queued', 'rj2')]));
    expect(await store().reanalyze('r1')).toBeNull();
    jobStatus.mockResolvedValueOnce({ status: 'running', progressText: 'CAPTION' });
    await tick();
    expect(jobStatus).toHaveBeenCalledWith('rj2');
    expect(phase()).toMatchObject({ kind: 'reading', step: 3 });
  });
});
