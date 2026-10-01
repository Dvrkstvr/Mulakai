import { describe, it, expect } from 'vitest';
import { lockHolder, waitLabel } from './generationJob';
import type { SingleEditorJob } from './editorJob';

const repaint: SingleEditorJob = { kind: 'repaint', jobId: 'r', songId: 's', layerId: 'l', startedAt: 1, stage: 'running' };

describe('lockHolder names what blocks an action', () => {
  it('names another tab\'s ANALYZE AUDIO seen by the poll', () => {
    const holder = lockHolder({ generating: false, otherLock: { kind: 'analyze' } });
    expect(holder).toBe('ANALYZE AUDIO');
    expect(waitLabel(holder!)).toBe('WAIT FOR ANALYZE AUDIO');
  });

  it('names an editor job by what the user pressed', () => {
    expect(lockHolder({ generating: false, otherLock: null, editorJob: repaint })).toBe('A REPAINT');
    expect(lockHolder({ generating: false, otherLock: null, editorJob: { ...repaint, kind: 'regenerate', versionId: 'v' } })).toBe('AN ALT TAKE');
    expect(lockHolder({ generating: false, otherLock: null, editorJob: { ...repaint, kind: 'retake', versionId: 'v' } })).toBe('A SIMILAR TAKE');
  });

  it('prefers what this tab tracks in detail over the polled lock, which may be the same job', () => {
    const polled = { kind: 'analyze' as const };
    expect(lockHolder({ generating: false, otherLock: polled, splitRunning: true, editorJob: repaint })).toBe('A STEM SPLIT');
    expect(lockHolder({ generating: true, otherLock: polled, editorJob: repaint })).toBe('A GENERATION');
    expect(lockHolder({ generating: false, otherLock: polled, editorJob: repaint })).toBe('A REPAINT');
  });

  it('skips a failed editor job (its lock is already released) and is null when nothing holds one', () => {
    const failed = { ...repaint, stage: 'failed' as const };
    expect(lockHolder({ generating: false, otherLock: { kind: 'lyrics' }, editorJob: failed })).toBe('READ LYRICS');
    // The Editor's background word-timings read (no button of its own) still names itself.
    expect(waitLabel(lockHolder({ generating: false, otherLock: { kind: 'timings' } })!)).toBe('WAIT FOR WORD TIMINGS');
    expect(lockHolder({ generating: false, otherLock: null, editorJob: failed })).toBeNull();
  });
});
