/** Quick Start outlives Create: the job keeps running when Create closes, and its result lands in
 * the draft through Create's reveal (open) or at once (closed). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefineResult } from './api';

type Follow = { resolve: (r: RefineResult | null) => void; reject: (e: Error) => void; onWait: (p: number | null) => void; stillWanted: () => boolean };
const follows = vi.hoisted(() => [] as Follow[]);
vi.mock('./lmJob', () => ({
  followLmJob: (_submit: unknown, onWait: Follow['onWait'], stillWanted: Follow['stillWanted']) =>
    new Promise<RefineResult | null>((resolve, reject) => { follows.push({ resolve, reject, onWait, stillWanted }); }),
}));

const { useQuickStartStore, sampleToDraft } = await import('./quickStartStore');
const { useCreateDraftStore } = await import('./createDraftStore');

const result: RefineResult = { caption: 'dark synthwave, female vox', lyrics: '[verse]\nneon rain', bpm: 112, key_scale: 'A minor' };
const qs = () => useQuickStartStore.getState();
const draft = () => useCreateDraftStore.getState();
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  follows.length = 0;
  useQuickStartStore.setState({ phase: 'idle', query: '', position: null, result: null, hosts: 0, error: '' });
  draft().clear();
  draft().load({ genType: 'prompt', pendingQuery: 'a lucky idea' });
});

describe('quickStartStore', () => {
  it('thinks about the idea and follows its place in the queue', () => {
    qs().start('a lucky idea');
    expect(qs()).toMatchObject({ phase: 'thinking', query: 'a lucky idea', position: null });
    follows[0].onWait(2);
    expect(qs().position).toBe(2);
  });

  it('a second start while thinking does not submit again', () => {
    qs().start('a lucky idea');
    qs().start('a lucky idea');
    expect(follows).toHaveLength(1);
  });

  it('Create closed: the result lands in the draft at once and the idea is retired', async () => {
    qs().start('a lucky idea');
    follows[0].resolve(result);
    await flush();
    expect(qs().phase).toBe('idle');
    expect(draft()).toMatchObject({ prompt: result.caption, lyrics: result.lyrics, bpm: 112, keyScale: 'A minor', formatted: true });
    expect(draft().pendingQuery).toBeUndefined();
  });

  it('Create open: the result waits for the reveal; finish retires the idea', async () => {
    qs().host();
    qs().start('a lucky idea');
    follows[0].resolve(result);
    await flush();
    expect(qs()).toMatchObject({ phase: 'revealing', result });
    expect(draft().prompt).toBe('');
    qs().finish();
    expect(qs().phase).toBe('idle');
    expect(draft().pendingQuery).toBeUndefined();
  });

  it('leaving Create mid-reveal lands the whole result', async () => {
    const release = qs().host();
    qs().start('a lucky idea');
    follows[0].resolve(result);
    await flush();
    release();
    expect(qs().phase).toBe('idle');
    expect(draft().prompt).toBe(result.caption);
  });

  it('a failure keeps the idea for RETRY and says what happened', async () => {
    qs().start('a lucky idea');
    follows[0].reject(new Error('the LM job failed'));
    await flush();
    expect(qs()).toMatchObject({ phase: 'idle', error: 'the LM job failed' });
    expect(draft().pendingQuery).toBe('a lucky idea');
  });

  it('cancelled from UP NEXT: the idea is dropped', async () => {
    qs().start('a lucky idea');
    follows[0].resolve(null);
    await flush();
    expect(qs().phase).toBe('idle');
    expect(draft().pendingQuery).toBeUndefined();
  });
});

describe('sampleToDraft', () => {
  it('fills the text unless the reveal types it', () => {
    expect(sampleToDraft(result)).toMatchObject({ prompt: result.caption, lyrics: result.lyrics, formatted: true });
    expect(sampleToDraft(result, false)).not.toHaveProperty('prompt');
  });
});
