/** The chat slice's 409s: a stale draft PUT (`{ok: false, current}`, CA-1) and CREATE SONG's re-check `{reason}`. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { chatApi, type ChatDraft } from './chat';

const DRAFT = { draft_v: 1, rev: 4, fields: {}, touched: {} } as unknown as ChatDraft;
const answer = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })));
afterEach(() => { vi.unstubAllGlobals(); });

describe('chatApi', () => {
  it('PUT draft sends the patch and its rev; a 409 is a conflict carrying the current draft', async () => {
    answer(409, { ok: false, current: DRAFT });
    expect(await chatApi.putChatDraft('t1', { title: null }, 3)).toEqual({ conflict: true, draft: DRAFT, blockers: undefined });
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/chat/threads/t1/draft');
    expect(JSON.parse(init.body)).toEqual({ fields: { title: null }, rev: 3 });
  });

  it('PUT draft 200 is the saved draft with its blockers and note', async () => {
    answer(200, { draft: DRAFT, blockers: ['no lyrics'], draftNote: null });
    expect(await chatApi.putChatDraft('t1', {}, 4)).toEqual({ draft: DRAFT, blockers: ['no lyrics'], draftNote: null });
  });

  it('CREATE SONG: 202 is the job, a 409 is the server\'s reason, any other error throws', async () => {
    answer(202, { jobId: 'g1' });
    expect(await chatApi.createChatSong('t1', 'p1')).toEqual({ jobId: 'g1' });
    answer(409, { reason: 'this proposal expired, ask again' });
    expect(await chatApi.createChatSong('t1', 'p1')).toEqual({ refused: 'this proposal expired, ask again' });
    answer(500, { error: 'boom' });
    await expect(chatApi.createChatSong('t1', 'p1')).rejects.toThrow('boom');
  });
});
