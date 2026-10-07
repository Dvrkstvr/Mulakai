/** `follow` on its own (the store's flows are in chatStore.test.ts): a 404 or five failed polls in a row read as
 * lost, a good poll resets the strikes, and a newer follow of the same job takes over from the old loop. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { ApiError } = await vi.importActual<typeof import('./api/http')>('./api/http');
const jobStatus = vi.fn<(id: string) => Promise<{ status: string }>>();
vi.mock('./api', () => ({ ApiError, api: { jobStatus: (id: string) => jobStatus(id) } }));

const { follow } = await import('./chatPoll');
const { POLL_MS } = await import('./transcribeStore');
const tick = (n = 1) => vi.advanceTimersByTimeAsync(POLL_MS * n);

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('chatPoll.follow', () => {
  it('a 404 is lost at once', async () => {
    const onLost = vi.fn(async () => undefined);
    jobStatus.mockRejectedValueOnce(new ApiError('gone', 404));
    void follow('j1', () => true, async () => false, onLost);
    await tick();
    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it('five failed polls in a row are lost; a good poll in between resets the count', async () => {
    const onLost = vi.fn(async () => undefined);
    jobStatus.mockRejectedValue(new Error('offline'));
    jobStatus.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ status: 'running' });
    void follow('j2', () => true, async () => false, onLost);
    await tick(6); // fail, ok, then four fails
    expect(onLost).not.toHaveBeenCalled();
    await tick(1);
    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it('a reload during SPLICING restores the edit card as an APPLY in that step (CB-5, F-049 #3)', async () => {
    const { chatPoll } = await import('./chatPoll');
    const { chatCommit } = await import('./chatTurn');
    let commit: import('./chatTurn').CommitState | null = null;
    const p = chatPoll({
      turnState: () => ({ phase: { kind: 'composing' } }) as never, commitState: () => commit, readingState: () => ({ cards: {} }) as never,
      turn: () => undefined, commit: (e) => { commit = chatCommit(commit, e); }, reading: () => undefined, refetch: async () => undefined,
    });
    jobStatus.mockResolvedValue({ status: 'running' });
    const card = { id: 'e', kind: 'edit', role: 'assistant', state: 'committing', jobId: 'r9', proposalId: 'e1', phase: 'splicing', job: { status: 'running', progressText: 'splicing' } };
    p.rehydrate({ messages: [card] } as never);
    expect(commit).toEqual({ proposalId: 'e1', jobId: 'r9', apply: true, phase: { kind: 'running', progressText: 'splicing', stage: null, progress: null } });
  });

  it('a newer follow of the same job takes over; the old loop stops polling for itself', async () => {
    const first = vi.fn(async () => false);
    const second = vi.fn(async () => false);
    jobStatus.mockResolvedValue({ status: 'running' });
    void follow('j3', () => true, first, async () => undefined);
    void follow('j3', () => true, second, async () => undefined);
    await tick(2);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });
});
