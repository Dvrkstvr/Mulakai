/** APPLY's commit (CB-5, F-047, F-049 #1, chat-edit.html 2): the same reducer as CREATE SONG's take, with the
 * edit job's phases (rendering, splicing, saving), a cancel that returns the card to pending saying so, and a
 * stale refusal that leaves the card to the server's STALE. */
import { describe, it, expect } from 'vitest';
import { chatCommit, type CommitEvent, type CommitState } from './chatTurn';

const commit = (s: CommitState | null, ...events: CommitEvent[]) => events.reduce(chatCommit, s);
const started = commit(null, { type: 'start', proposalId: 'e1', apply: true }, { type: 'started', jobId: 'r1' });

describe('chatCommit for APPLY', () => {
  it('start marks the commit as an APPLY; started queues it', () => {
    expect(started).toEqual({ proposalId: 'e1', jobId: 'r1', apply: true, phase: { kind: 'queued', ahead: 0 } });
  });

  it('a running poll carries the step, the stage and its share', () => {
    const s = commit(started, { type: 'poll', job: { status: 'running', progressText: 'rendering', progressStage: 'stage2', progress: 0.62 } });
    expect(s?.phase).toEqual({ kind: 'running', progressText: 'rendering', stage: 'stage2', progress: 0.62 });
    expect(commit(s, { type: 'poll', job: { status: 'running', progressText: 'splicing' } })?.phase)
      .toEqual({ kind: 'running', progressText: 'splicing', stage: null, progress: null });
  });

  it('a cancel puts the card back to pending and names the step it stopped in', () => {
    const s = commit(started, { type: 'poll', job: { status: 'running', progressText: 'splicing' } },
      { type: 'poll', job: { status: 'failed', cancelled: true, error: 'cancelled' } });
    expect(s).toEqual({ proposalId: 'e1', jobId: null, apply: true, phase: { kind: 'cancelled', during: 'splicing' } });
  });

  it('a running APPLY aborted by CANCEL ends failed with "Aborted": that is a cancel too', () => {
    const s = commit(started, { type: 'poll', job: { status: 'running', progressText: 'rendering' } },
      { type: 'poll', job: { status: 'failed', error: 'Aborted' } });
    expect(s?.phase).toEqual({ kind: 'cancelled', during: 'rendering' });
  });

  it("CREATE SONG's take still ends with nothing on a cancel", () => {
    const take = commit(null, { type: 'start', proposalId: 'p1' }, { type: 'started', jobId: 'g1' });
    expect(commit(take, { type: 'poll', job: { status: 'failed', cancelled: true } })).toBeNull();
  });

  it('a failure keeps the error; done ends it', () => {
    expect(commit(started, { type: 'poll', job: { status: 'failed', error: 'out of memory' } })?.phase).toEqual({ kind: 'failed', error: 'out of memory' });
    expect(commit(started, { type: 'poll', job: { status: 'done' } })).toBeNull();
  });

  it('a stale refusal ends it (the card reads STALE from the server); another refusal is the error', () => {
    const pressed = commit(null, { type: 'start', proposalId: 'e1', apply: true });
    expect(commit(pressed, { type: 'refused', error: 'this song changed since the proposal', stale: true })).toBeNull();
    expect(commit(pressed, { type: 'refused', error: 'a model is still loaded' })?.phase).toEqual({ kind: 'failed', error: 'a model is still loaded' });
  });

  it('a pending card pressed again after a cancel starts over', () => {
    const cancelled = commit(started, { type: 'poll', job: { status: 'failed', cancelled: true } });
    expect(commit(cancelled, { type: 'start', proposalId: 'e1', apply: true })?.phase).toEqual({ kind: 'starting' });
  });

  it('a reload restores the step the server names', () => {
    expect(commit(null, { type: 'restore', proposalId: 'e1', jobId: 'r1', apply: true, phase: 'splicing' }))
      .toEqual({ proposalId: 'e1', jobId: 'r1', apply: true, phase: { kind: 'running', progressText: 'splicing', stage: null, progress: null } });
    expect(commit(null, { type: 'restore', proposalId: 'e1', jobId: 'r1', apply: true, phase: 'queued' })?.phase).toEqual({ kind: 'queued', ahead: 0 });
  });
});
