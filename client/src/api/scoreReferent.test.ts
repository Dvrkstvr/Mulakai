/** POST plan with a pick and REVISE (F-032, F-033): the body it sends, a 409 stale pick as `{stale}`, any other
 * refusal thrown. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scoreApi } from './score';
import type { ScoreReferent } from './scoreReferent';

const CHORUS2: ScoreReferent = { kind: 'section', section: 5, label: 'chorus', occurrence: 2, of: 3, bars: [29, 36] };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
vi.stubGlobal('fetch', fetchMock);
afterEach(() => fetchMock.mockReset());

describe('startScorePlan', () => {
  it('sends the request, the referent (null = whole song) and the plan a REVISE changes', async () => {
    fetchMock.mockImplementation(async () => reply(202, { jobId: 'j', queuePosition: 0 }));
    expect(await scoreApi.startScorePlan('s1', 'jazz', { referent: CHORUS2, revise: 'p1' })).toEqual({ jobId: 'j', queuePosition: 0 });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ request: 'jazz', referent: CHORUS2, revise: 'p1' });
    await scoreApi.startScorePlan('s1', 'jazz');
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toEqual({ request: 'jazz', referent: null });
  });
  it('a 409 stale pick comes back as {stale}; any other 409 throws its reason', async () => {
    const stale = { picked: CHORUS2, now: null, reason: 'chorus #2 (bars 29-36) is no longer in the score' };
    fetchMock.mockImplementation(async () => reply(409, { error: 'the selection is stale: x', stale }));
    expect(await scoreApi.startScorePlan('s1', 'jazz', { referent: CHORUS2 })).toEqual({ stale, error: 'the selection is stale: x' });
    fetchMock.mockImplementation(async () => reply(409, { error: 'that plan was replaced or has expired: revise the plan on screen, or PLAN again' }));
    await expect(scoreApi.startScorePlan('s1', 'jazz', { revise: 'p0' })).rejects.toThrow('that plan was replaced');
  });
});
