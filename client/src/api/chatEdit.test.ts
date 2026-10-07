/** APPLY on an edit card (CB-3's route): 202 is the job; a 409 is the re-check's reason, `stale` when the song changed. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { chatEditApi } from './chatEdit';

const answer = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })));
afterEach(() => { vi.unstubAllGlobals(); });

describe('chatEditApi.applyChatEdit', () => {
  it('posts the proposal id; 202 is the job', async () => {
    answer(202, { jobId: 'r1' });
    expect(await chatEditApi.applyChatEdit('t1', 'p1')).toEqual({ jobId: 'r1' });
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/chat/threads/t1/apply');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ proposalId: 'p1' });
  });

  it('a 409 is refused with the reason and whether it is stale', async () => {
    answer(409, { reason: 'this song changed since the proposal', stale: true });
    expect(await chatEditApi.applyChatEdit('t1', 'p1')).toEqual({ refused: 'this song changed since the proposal', stale: true });
    answer(409, { reason: 'a model is still loaded', stale: false });
    expect(await chatEditApi.applyChatEdit('t1', 'p1')).toEqual({ refused: 'a model is still loaded', stale: false });
  });

  it('any other error throws', async () => {
    answer(500, { error: 'boom' });
    await expect(chatEditApi.applyChatEdit('t1', 'p1')).rejects.toThrow('boom');
  });
});
