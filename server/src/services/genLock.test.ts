import { describe, it, expect, afterEach } from 'vitest';
import { acquireGenLock, releaseGenLock, getGenLock, GenLockError } from './genLock.js';

afterEach(() => {
  const lock = getGenLock();
  if (lock) releaseGenLock(lock.jobId);
});

describe('genLock', () => {
  it('allows the first acquire and reports it via getGenLock', () => {
    acquireGenLock({ kind: 'generate', jobId: 'job-1', title: 'Test Song' });
    expect(getGenLock()).toMatchObject({ kind: 'generate', jobId: 'job-1', title: 'Test Song' });
  });

  it('rejects a second acquire while one is held, regardless of kind', () => {
    acquireGenLock({ kind: 'generate', jobId: 'job-1' });
    expect(() => acquireGenLock({ kind: 'remaster', jobId: 'job-2', songId: 'song-1' })).toThrow(GenLockError);
  });

  it('names the holder in the refusal', () => {
    acquireGenLock({ kind: 'analyze', jobId: 'analyze-1' });
    expect(() => acquireGenLock({ kind: 'generate', jobId: 'job-2' })).toThrow('an audio analysis is already in progress');
    releaseGenLock('analyze-1');
    acquireGenLock({ kind: 'generate', jobId: 'job-1' });
    expect(() => acquireGenLock({ kind: 'analyze', jobId: 'analyze-2' })).toThrow('a generation is already in progress');
  });

  it('releasing a non-holder jobId is a no-op', () => {
    acquireGenLock({ kind: 'generate', jobId: 'job-1' });
    releaseGenLock('some-other-id');
    expect(getGenLock()?.jobId).toBe('job-1');
  });

  it('allows a new acquire once the holder releases', () => {
    acquireGenLock({ kind: 'generate', jobId: 'job-1' });
    releaseGenLock('job-1');
    expect(getGenLock()).toBeNull();
    acquireGenLock({ kind: 'split', jobId: 'job-2' });
    expect(getGenLock()?.jobId).toBe('job-2');
  });
});
