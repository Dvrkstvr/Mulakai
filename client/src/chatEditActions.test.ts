/** APPLY and its CANCEL from the edit card (CB-5, F-047, F-049 #1 and edge), through the commit reducer. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatThreadView } from './api/chat';
import { chatApi } from './api/chat';
import { chatEditApi } from './api/chatEdit';
import { chatEditActions } from './chatEditActions';
import { chatCommit, type CommitEvent, type CommitState } from './chatTurn';

afterEach(() => { vi.restoreAllMocks(); });

function setup(thread: ChatThreadView | null = { id: 't1', songId: 's1' } as ChatThreadView) {
  let state: CommitState | null = null;
  const deps = {
    thread: () => thread,
    commitState: () => state,
    commit: (e: CommitEvent) => { state = chatCommit(state, e); },
    refetch: vi.fn(async () => undefined),
    followCommit: vi.fn(async () => undefined),
  };
  return { deps, actions: chatEditActions(deps), state: () => state };
}

describe('chatEditActions', () => {
  it('APPLY posts the proposal, follows the job and refetches the thread', async () => {
    vi.spyOn(chatEditApi, 'applyChatEdit').mockResolvedValue({ jobId: 'r1' });
    const { deps, actions, state } = setup();
    await actions.apply('e1');
    expect(chatEditApi.applyChatEdit).toHaveBeenCalledWith('t1', 'e1');
    expect(state()).toEqual({ proposalId: 'e1', jobId: 'r1', apply: true, phase: { kind: 'queued', ahead: 0 } });
    expect(deps.followCommit).toHaveBeenCalledWith('r1');
    expect(deps.refetch).toHaveBeenCalled();
  });

  it('a stale refusal ends the commit and refetches (the card reads STALE); another refusal stays on the card', async () => {
    vi.spyOn(chatEditApi, 'applyChatEdit').mockResolvedValueOnce({ refused: 'this song changed since the proposal', stale: true });
    const a = setup();
    await a.actions.apply('e1');
    expect(a.state()).toBeNull();
    expect(a.deps.refetch).toHaveBeenCalled();
    vi.spyOn(chatEditApi, 'applyChatEdit').mockResolvedValueOnce({ refused: 'a model is still loaded', stale: false });
    const b = setup();
    await b.actions.apply('e1');
    expect(b.state()?.phase).toEqual({ kind: 'failed', error: 'a model is still loaded' });
    expect(b.deps.followCommit).not.toHaveBeenCalled();
  });

  it('a second APPLY while one runs is ignored', async () => {
    vi.spyOn(chatEditApi, 'applyChatEdit').mockResolvedValue({ jobId: 'r1' });
    const { actions } = setup();
    await actions.apply('e1');
    await actions.apply('e1');
    expect(chatEditApi.applyChatEdit).toHaveBeenCalledTimes(1);
  });

  it("CANCEL goes to the chat's job cancel with the running APPLY's job", async () => {
    vi.spyOn(chatEditApi, 'applyChatEdit').mockResolvedValue({ jobId: 'r1' });
    const cancel = vi.spyOn(chatApi, 'cancelChatJob').mockResolvedValue({ ok: true, aborted: true });
    const { actions } = setup();
    await actions.cancelApply();
    expect(cancel).not.toHaveBeenCalled();
    await actions.apply('e1');
    await actions.cancelApply();
    expect(cancel).toHaveBeenCalledWith('r1');
  });
});
