/** C3's HTTP: READ / RE-ANALYZE answer a job or the server's reason; a refused library pick throws its reason;
 * the turn body carries `attach`; SEND during a reading is a 409 TURN_OPEN with the reason. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { chatApi } from './chat';
import { chatReferencesApi, isNotRead } from './chatReferences';

const answer = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })));
const lastCall = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
afterEach(() => { vi.unstubAllGlobals(); });

describe('chatReferencesApi', () => {
  it('READ: 202 the job, 409 the reason', async () => {
    answer(202, { jobId: 'rj1' });
    expect(await chatReferencesApi.readReference('t1', 'p1')).toEqual({ jobId: 'rj1' });
    expect(lastCall()[0]).toBe('/api/chat/threads/t1/read');
    expect(JSON.parse(lastCall()[1].body)).toEqual({ proposalId: 'p1' });
    answer(409, { reason: 'a model is still loaded' });
    expect(await chatReferencesApi.readReference('t1', 'p1')).toEqual({ refused: 'a model is still loaded' });
  });

  it('RE-ANALYZE posts to the reference', async () => {
    answer(202, { jobId: 'rj2' });
    expect(await chatReferencesApi.rereadReference('r1')).toEqual({ jobId: 'rj2' });
    expect(lastCall()[0]).toBe('/api/chat/references/r1/read');
  });

  it('a library pick refused throws the server\'s reason', async () => {
    answer(400, { reason: 'this song has no audio' });
    await expect(chatReferencesApi.pickLibraryReference('t1', 's1')).rejects.toThrow('this song has no audio');
    expect(JSON.parse(lastCall()[1].body)).toEqual({ songId: 's1' });
  });

  it('isNotRead tells a not-read part from a read one', () => {
    expect(isNotRead({ notRead: 'ACE-Step is not running' })).toBe(true);
    expect(isNotRead({ caption: 'piano', bpm: 70, key: null, meter: null })).toBe(false);
  });
});

describe('chatApi.startChatTurn (C3)', () => {
  it('carries attach only when there is one', async () => {
    answer(202, { jobId: 'j1', messageId: 'u1', position: 0 });
    await chatApi.startChatTurn('t1', 'hi', 'k1', { referenceId: 'r1' });
    expect(JSON.parse(lastCall()[1].body)).toEqual({ text: 'hi', clientKey: 'k1', attach: { referenceId: 'r1' } });
    await chatApi.startChatTurn('t1', 'hi', 'k2');
    expect(JSON.parse(lastCall()[1].body)).toEqual({ text: 'hi', clientKey: 'k2' });
  });

  it('409 TURN_OPEN (a reading or its follow-up runs) throws the server\'s reason', async () => {
    answer(409, { error: 'TURN_OPEN', reason: 'the reference is still being read' });
    await expect(chatApi.startChatTurn('t1', 'hi', 'k1')).rejects.toThrow('the reference is still being read');
  });
});
