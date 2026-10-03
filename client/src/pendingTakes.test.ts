import { describe, it, expect } from 'vitest';
import type { QueueEntry } from './api';
import type { SingleEditorJob } from './editorJob';
import { pendingTakes } from './pendingTakes';

const vocals = { id: 'l1', name: 'Vocals', songId: 's1' };
const job = (over: Partial<SingleEditorJob>): SingleEditorJob =>
  ({ kind: 'repaint', key: 'k1', jobId: 'r1', songId: 's1', layerId: 'l1', startedAt: 1, stage: 'running', ...over }) as SingleEditorJob;
const entry = (over: Partial<QueueEntry>): QueueEntry =>
  ({ kind: 'repaint', jobId: 'q1', songId: 's1', layer: 'Vocals', position: 1, queuedAt: 1, ...over });
const empty = { running: null, queued: [] };

describe('pendingTakes', () => {
  it("is 0 with nothing on its way, so the next take is the layer's next version", () => {
    expect(pendingTakes(vocals, [], empty)).toBe(0);
  });

  it("counts this tab's repaint, alt and similar takes on the layer, queued or running", () => {
    const jobs = [
      job({}),
      job({ key: 'k2', jobId: 'r2', queuePosition: 1 }),
      job({ key: 'k3', jobId: '', kind: 'regenerate', versionId: 'v1' } as Partial<SingleEditorJob>), // still submitting
      job({ key: 'k4', jobId: 'r4', kind: 'retake', versionId: 'v1' } as Partial<SingleEditorJob>),
    ];
    expect(pendingTakes(vocals, jobs, empty)).toBe(4);
  });

  it('leaves out other layers, settled jobs and kinds that add no take', () => {
    const jobs = [
      job({ layerId: 'l2' }),
      job({ key: 'k2', jobId: 'r2', stage: 'done' }),
      job({ key: 'k3', jobId: 'r3', stage: 'failed' }),
      { kind: 'addLayer', key: 'k4', jobId: 'a1', songId: 's1', startedAt: 1, stage: 'running' } as SingleEditorJob,
    ];
    expect(pendingTakes(vocals, jobs, { running: null, queued: [entry({ kind: 'split' }), entry({ jobId: 'q2', layer: 'Bass' })] })).toBe(0);
  });

  it("adds another tab's takes from the server's queue, counting a job this tab follows once", () => {
    const queue = {
      running: { kind: 'repaint' as const, jobId: 'r1', songId: 's1', layer: 'Vocals', startedAt: 1 },
      queued: [entry({ jobId: 'other', layer: 'vocals' }), entry({ jobId: 'elsewhere', songId: 's2' })],
    };
    expect(pendingTakes(vocals, [job({})], queue)).toBe(2);
  });
});
