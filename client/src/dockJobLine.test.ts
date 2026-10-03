import { describe, it, expect } from 'vitest';
import type { SingleEditorJob } from './editorJob';
import { dockJobLine, songBadgeJob } from './dockJobLine';
import { landedEdits } from './useLandedReload';

const repaint = (over: Partial<SingleEditorJob>): SingleEditorJob =>
  ({ kind: 'repaint', key: 'k1', jobId: 'r1', songId: 's1', layerId: 'l1', startedAt: 1, stage: 'running', ...over }) as SingleEditorJob;

describe("a commit's own job lines", () => {
  it('says how far a running job has got', () => {
    expect(dockJobLine(repaint({ progress: 0.38 }), 42_000)).toBe('REPAINTING… 0:42 · 38%');
    expect(dockJobLine(repaint({ kind: 'addLayer' } as Partial<SingleEditorJob>), 5_000)).toBe('ADDING LAYER… 0:05');
  });

  it('says where a waiting job is in line, and that a submit is still answering', () => {
    expect(dockJobLine(repaint({ queuePosition: 2 }), 0)).toBe('REPAINTING · QUEUED · STARTS AFTER 2 JOBS');
    expect(dockJobLine(repaint({ jobId: '' }), 0)).toBe('REPAINTING · STARTING…');
  });
});

describe('landedEdits', () => {
  it("names the open song's edits that landed, whichever layer or verb started them", () => {
    const jobs = [
      repaint({ stage: 'done' }),
      repaint({ key: 'k2', stage: 'running' }),
      repaint({ key: 'k3', songId: 's2', stage: 'done' }),
      { kind: 'addLayer', key: 'k4', jobId: 'a', songId: 's1', startedAt: 1, stage: 'done' } as SingleEditorJob,
      { kind: 'remaster', key: 'k5', jobId: 'm', songId: 's1', startedAt: 1, stage: 'done' } as SingleEditorJob,
    ];
    expect(landedEdits(jobs, 's1')).toBe('k1,k4');
    expect(landedEdits(jobs, 's9')).toBe('');
  });
});

describe("a Library row's job badge", () => {
  it('shows the job the GPU works on over those waiting, and either over a failure', () => {
    const failed = repaint({ key: 'f', stage: 'failed' });
    const waiting = repaint({ key: 'w', queuePosition: 1 });
    const working = repaint({ key: 'r' });
    expect(songBadgeJob([failed, waiting, working], null, 's1')?.key).toBe('r');
    expect(songBadgeJob([failed, waiting], null, 's1')?.key).toBe('w');
    expect(songBadgeJob([failed], null, 's1')?.key).toBe('f');
    expect(songBadgeJob([working], null, 's2')).toBeNull();
  });
});
