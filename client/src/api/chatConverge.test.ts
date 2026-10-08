/** UNDO TURN's route (CV-3, architecture.md "Wire contract (client ↔ server)"): 200 is what was restored and kept,
 * 409 a named refusal, anything else throws. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { chatConvergeApi } from './chatConverge';

const answer = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })));
afterEach(() => { vi.unstubAllGlobals(); });

const DRAFT = { draft_v: 1, rev: 7, fields: {}, touched: {} };

describe('chatConvergeApi.undoTurn', () => {
  it('posts to the message; 200 is the draft and what was restored and kept', async () => {
    const body = { draft: DRAFT, blockers: ['add a style'], restored: ['title', 'style'], kept: [{ field: 'lyrics', reason: 'you changed it' }] };
    answer(200, body);
    expect(await chatConvergeApi.undoTurn('t1', 'm9')).toEqual(body);
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/chat/threads/t1/messages/m9/undo');
    expect(init.method).toBe('POST');
  });

  it('a 409 is a refusal with its code and reason', async () => {
    answer(409, { error: 'UNDO_REFUSED', reason: 'this turn was undone already' });
    expect(await chatConvergeApi.undoTurn('t1', 'm9')).toEqual({ refused: 'this turn was undone already', code: 'UNDO_REFUSED' });
    answer(409, { error: 'TURN_OPEN', reason: 'a turn is running' });
    expect(await chatConvergeApi.undoTurn('t1', 'm9')).toEqual({ refused: 'a turn is running', code: 'TURN_OPEN' });
  });

  it('a 409 without a reason names the code; a 404 throws', async () => {
    answer(409, { error: 'UNDO_REFUSED' });
    expect(await chatConvergeApi.undoTurn('t1', 'm9')).toEqual({ refused: 'UNDO_REFUSED', code: 'UNDO_REFUSED' });
    answer(404, { error: 'message not found' });
    await expect(chatConvergeApi.undoTurn('t1', 'm9')).rejects.toThrow('message not found');
  });
});
