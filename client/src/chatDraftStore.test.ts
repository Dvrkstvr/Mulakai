/** The one draft (D-086) against a mocked server: hand edits debounced with their rev, a 409 rebased so the hand
 * edit wins, a reply's filled fields (CH-4) and the touched / skipped marks (CH-6). */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ChatDraft, ChatDraftFields, ChatDraftPut } from './api/chat';

const putChatDraft = vi.fn<(id: string, fields: Partial<ChatDraftFields>, rev: number) => Promise<ChatDraftPut>>();
vi.mock('./api/chat', () => ({ chatApi: { putChatDraft: (id: string, f: Partial<ChatDraftFields>, r: number) => putChatDraft(id, f, r) } }));

const { useChatDraftStore, DRAFT_SAVE_MS, fieldMark, filledCount, liveFields, skipsAtReply } = await import('./chatDraftStore');

const FIELDS: ChatDraftFields = {
  title: null, style: 'slow ballad', bpm: 68, key: 'Am', timeSignature: null, language: null, structure: [], lyrics: [], engine: 'yue2',
};
const draft = (rev: number, fields: Partial<ChatDraftFields> = {}, touched: ChatDraft['touched'] = {}): ChatDraft =>
  ({ draft_v: 1, rev, fields: { ...FIELDS, ...fields }, touched });
const store = () => useChatDraftStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  store().clear();
  store().hydrate('t1', { draft: draft(1), blockers: ['the draft has no lyrics'] });
});
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('chatDraftStore', () => {
  it('a hand edit shows at once, reads YOURS, and is PUT once after the debounce with the rev it was made on', async () => {
    putChatDraft.mockResolvedValue({ draft: draft(2, { title: 'Luz' }, { title: 2 }), blockers: [] });
    store().edit('title', 'L');
    store().edit('title', 'Luz');
    expect(liveFields(store())?.title).toBe('Luz');
    expect(fieldMark(store(), 'title')).toBe('yours');
    await vi.advanceTimersByTimeAsync(DRAFT_SAVE_MS);
    expect(putChatDraft).toHaveBeenCalledTimes(1);
    expect(putChatDraft).toHaveBeenCalledWith('t1', { title: 'Luz' }, 1);
    expect(store()).toMatchObject({ pending: {}, blockers: [] });
    expect(store().draft?.rev).toBe(2);
    expect(fieldMark(store(), 'title')).toBe('yours'); // touched on the server now
  });

  it('a 409 (a reply landed meanwhile) rebases the edit onto the server\'s draft: the hand edit wins', async () => {
    putChatDraft
      .mockResolvedValueOnce({ conflict: true, draft: draft(3, { bpm: 60, title: 'Mar' }), blockers: [] })
      .mockResolvedValueOnce({ draft: draft(4, { bpm: 60, title: 'Luz' }, { title: 4 }), blockers: [] });
    store().edit('title', 'Luz');
    await store().flush();
    expect(putChatDraft.mock.calls.map((c) => c[2])).toEqual([1, 3]);
    expect(putChatDraft.mock.calls[1][1]).toEqual({ title: 'Luz' });
    expect(liveFields(store())).toMatchObject({ title: 'Luz', bpm: 60 });
  });

  it('an edit made while a PUT is in flight stays pending and is sent next', async () => {
    let answer!: (v: ChatDraftPut) => void;
    putChatDraft.mockReturnValueOnce(new Promise((r) => { answer = r; }));
    store().edit('title', 'Luz');
    const first = store().flush();
    store().edit('bpm', 72);
    answer({ draft: draft(2, { title: 'Luz' }, { title: 2 }), blockers: [] });
    await first;
    expect(store().pending).toEqual({ bpm: 72 });
    putChatDraft.mockResolvedValueOnce({ draft: draft(3, { title: 'Luz', bpm: 72 }), blockers: [] });
    await store().flush();
    expect(putChatDraft).toHaveBeenLastCalledWith('t1', { bpm: 72 }, 2);
  });

  it('a failed PUT keeps the edit and says why', async () => {
    putChatDraft.mockRejectedValueOnce(new Error('HTTP 500'));
    store().edit('title', 'Luz');
    await store().flush();
    expect(store()).toMatchObject({ pending: { title: 'Luz' }, error: 'HTTP 500' });
  });

  it('a reply\'s changed fields read ASSISTANT with the old value; a hand edit or the next SEND clears it', () => {
    store().hydrate('t1', { draft: draft(2, { bpm: 60, style: 'slow, dark ballad' }), blockers: [] }, ['bpm', 'style']);
    expect(fieldMark(store(), 'bpm')).toBe('assistant');
    expect(store().filled.bpm).toEqual({ old: 68 });
    store().edit('bpm', 62);
    expect(fieldMark(store(), 'bpm')).toBe('yours');
    expect(fieldMark(store(), 'style')).toBe('assistant');
    store().clearFilled();
    expect(fieldMark(store(), 'style')).toBe('plain');
  });

  it('a field touched before a reply that then filled it no longer reads YOURS', () => {
    store().hydrate('t1', { draft: draft(2, { title: 'Luz' }, { title: 2 }), blockers: [] });
    expect(fieldMark(store(), 'title')).toBe('yours');
    store().hydrate('t1', { draft: draft(3, { title: 'Mar' }, { title: 2 }), blockers: [] }, ['title']);
    store().clearFilled();
    expect(fieldMark(store(), 'title')).toBe('plain');
  });

  it('skipsAtReply: touched after SEND (or still unsaved) is skipped; touched before is not', () => {
    store().hydrate('t1', { draft: draft(5, {}, { title: 5, style: 2 }), blockers: [] });
    expect(skipsAtReply(store(), 'title', 4)).toBe(true);
    expect(skipsAtReply(store(), 'style', 4)).toBe(false);
    store().edit('key', 'Dm');
    expect(skipsAtReply(store(), 'key', 5)).toBe(true);
  });

  it('another thread drops the pending edits and marks; the same thread keeps the pending edits', () => {
    store().edit('title', 'Luz');
    store().hydrate('t1', { draft: draft(2), blockers: [] });
    expect(store().pending).toEqual({ title: 'Luz' });
    store().hydrate('t2', { draft: draft(1), blockers: [] });
    expect(store()).toMatchObject({ threadId: 't2', pending: {}, filled: {} });
  });

  it('an emptied field is sent as null (the server clears it); the server draftNote is kept to show', async () => {
    putChatDraft.mockResolvedValue({ draft: draft(2), blockers: [], draftNote: 'this draft was saved by a newer Mulakai; it starts empty' });
    store().edit('style', '');
    await store().flush();
    expect(putChatDraft).toHaveBeenCalledWith('t1', { style: null }, 1);
    expect(store().draftNote).toBe('this draft was saved by a newer Mulakai; it starts empty');
  });

  it('the rail counts fields with a value, not the fixed engine', () => {
    expect(filledCount(liveFields(store()))).toBe(3);
    expect(filledCount(null)).toBe(0);
  });
});
