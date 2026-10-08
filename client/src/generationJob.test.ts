/** Which landed take the Library's footer player loads: a Create take does, a chat take plays in the chat (owner, 2026-10-08). */
import { describe, expect, it } from 'vitest';
import type { ActiveGeneration } from './api';
import { adoptLock, landedTakes } from './generationJob';
import type { GenerationJob } from './generationStore';

const job = (over: Partial<GenerationJob>): GenerationJob =>
  ({ key: over.jobId ?? 'k', jobId: 'j', title: 't', caption: '', stage: 'done', startedAt: 0, draft: {} as never, ...over });

describe('landedTakes', () => {
  it('a Create take that lands is refreshed into the Library and loaded into its player', () => {
    expect(landedTakes([job({ jobId: 'a', songId: 's1' })], new Set())).toEqual({ fresh: ['s1'], play: 's1' });
  });
  it('a chat take is refreshed into the Library but never loaded into the Library player', () => {
    expect(landedTakes([job({ jobId: 'c', songId: 's2', origin: 'chat' })], new Set())).toEqual({ fresh: ['s2'], play: null });
  });
  it('the newest Create take wins; a chat take landing after it does not take the player', () => {
    const jobs = [job({ jobId: 'a', songId: 's1' }), job({ jobId: 'c', songId: 's2', origin: 'chat' })];
    expect(landedTakes(jobs, new Set())).toEqual({ fresh: ['s1', 's2'], play: 's1' });
  });
  it('a seen song, a running take and a failed one are not fresh', () => {
    const jobs = [job({ songId: 's1' }), job({ stage: 'running' }), job({ stage: 'failed' })];
    expect(landedTakes(jobs, new Set(['s1']))).toEqual({ fresh: [], play: null });
  });
});

describe('adoptLock', () => {
  it('a chat take found running on the server stays a chat take', () => {
    const active = { kind: 'generate', jobId: 'c', startedAt: 0, status: 'running', task: 'text2music', engine: 'yue2', origin: 'chat' } as ActiveGeneration;
    expect(adoptLock(active).origin).toBe('chat');
    expect(adoptLock({ ...active, origin: undefined }).origin).toBeUndefined();
  });
});
