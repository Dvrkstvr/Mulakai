/** C1's HTTP: the analysis view, RETRY's job or reason, the mark preview; the turn body carries `mark`; a 409
 * MARK_STALE (turn or preview) is a `MarkStaleError` with the old place and the shift. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { chatApi } from './chat';
import { MarkStaleError, chatAnalysisApi, type RangeMark } from './chatAnalysis';
import { ApiError } from './http';

const answer = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })));
const lastCall = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
afterEach(() => { vi.unstubAllGlobals(); });

const MARK: RangeMark = { kind: 'range', versionId: 'v4', bars: [25, 34], seconds: [57.6, 81.6] };
const STALE = { error: 'MARK_STALE', reason: 'your mark was on v4; v5 moved those bars', was: MARK, shift: { atBar: 17, delta: 8 } };

describe('chatAnalysisApi', () => {
  it('GET the song’s analysis view', async () => {
    answer(200, { songId: 's1', versionId: null });
    expect(await chatAnalysisApi.analysisView('s1')).toMatchObject({ songId: 's1' });
    expect(lastCall()[0]).toBe('/api/chat/songs/s1/analysis');
  });

  it('RETRY: 202 the job, 409 the reason', async () => {
    answer(202, { jobId: 'a2' });
    expect(await chatAnalysisApi.retryAnalysis('s1')).toEqual({ jobId: 'a2' });
    expect(lastCall()[0]).toBe('/api/chat/songs/s1/analysis/retry');
    answer(409, { reason: 'a model is still loaded' });
    expect(await chatAnalysisApi.retryAnalysis('s1')).toEqual({ refused: 'a model is still loaded' });
  });

  it('the preview posts the mark; a stale mark throws MarkStaleError', async () => {
    answer(200, { rows: [{ name: 'RANGE', value: 'bars 25–34' }], sent: { mark: {} } });
    expect((await chatAnalysisApi.markPreview('t1', MARK)).rows).toHaveLength(1);
    expect(lastCall()[0]).toBe('/api/chat/threads/t1/mark/preview');
    expect(JSON.parse(lastCall()[1].body)).toEqual({ mark: MARK });
    answer(409, STALE);
    const err = await chatAnalysisApi.markPreview('t1', MARK).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MarkStaleError);
    expect(err).toMatchObject({ status: 409, message: STALE.reason, was: MARK, shift: STALE.shift });
  });
});

describe('the turn body (api/chat.ts)', () => {
  it('carries `mark` when given, alone or with `attach`; none without', async () => {
    answer(202, { jobId: 'j1', messageId: 'u1', position: 0 });
    await chatApi.startChatTurn('t1', 'make this jazzier', 'k1', null, MARK);
    expect(JSON.parse(lastCall()[1].body)).toEqual({ text: 'make this jazzier', clientKey: 'k1', mark: MARK });
    await chatApi.startChatTurn('t1', 'hi', 'k2', { referenceId: 'r1' }, MARK);
    expect(JSON.parse(lastCall()[1].body)).toEqual({ text: 'hi', clientKey: 'k2', attach: { referenceId: 'r1' }, mark: MARK });
    await chatApi.startChatTurn('t1', 'hi', 'k3');
    expect(JSON.parse(lastCall()[1].body)).toEqual({ text: 'hi', clientKey: 'k3' });
  });

  it('409 MARK_STALE is a MarkStaleError; 409 TURN_OPEN stays an ApiError with the reason', async () => {
    answer(409, STALE);
    const stale = await chatApi.startChatTurn('t1', 'x', 'k1', null, MARK).catch((e: unknown) => e);
    expect(stale).toBeInstanceOf(MarkStaleError);
    answer(409, { error: 'TURN_OPEN', reason: 'a reading still runs' });
    const open = await chatApi.startChatTurn('t1', 'x', 'k1').catch((e: unknown) => e);
    expect(open).toBeInstanceOf(ApiError);
    expect(open).not.toBeInstanceOf(MarkStaleError);
    expect(open).toMatchObject({ message: 'a reading still runs', status: 409 });
  });
});
