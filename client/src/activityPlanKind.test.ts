/** The server's queue has a `plan` kind (score planner, F-019 #5). The client's kind union names it
 * (job-queue rule), so a running or queued plan reads as a plain, labelled row in Activity and the
 * Header's `/active` poll. */
import { describe, it, expect } from 'vitest';
import type { ActiveGeneration, QueueEntry } from './api';
import { RUNNING_LABEL, runningRows, type RunningSources } from './activityRunning';
import { queuedLine, queuedTitle } from './queueCopy';

const idle = (over: Partial<RunningSources> = {}): RunningSources => ({
  genJobs: [], editorJobs: [], splitJob: null,
  transcribe: { stage: 'idle' }, readLyrics: { stage: 'idle' }, timings: {}, active: null, ...over,
});

// What GET /api/generate/active sends while a plan holds the slot.
const plan: ActiveGeneration = { kind: 'plan', jobId: 'p1', songId: 's1', title: 'Copper Sky', startedAt: 5, status: 'running' };

describe('a running plan in Activity (F-019 #5)', () => {
  it('maps to one plain row, labelled PLANNING SCORE, that ABORT can reach', () => {
    const rows = runningRows(idle({ active: plan }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: 'active:p1', jobId: 'p1', songId: 's1', title: 'Copper Sky', startedAt: 5, label: 'PLANNING SCORE', ai: false, abortable: true,
    });
    expect(RUNNING_LABEL.plan).toBe('PLANNING SCORE');
  });

  it('drops out once the poll says it settled', () => {
    expect(runningRows(idle({ active: { ...plan, status: 'done' } }))).toEqual([]);
    expect(runningRows(idle({ active: plan, settledIds: new Set(['p1']) }))).toEqual([]);
  });

  it('reads as an UP NEXT row while it waits in the queue (the server labels it)', () => {
    const entry: QueueEntry = { kind: 'plan', jobId: 'p1', songId: 's1', title: 'Copper Sky', label: 'score plan', position: 2, queuedAt: 1 };
    expect(queuedLine(entry)).toBe('SCORE PLAN · starts after 2 jobs');
    expect(queuedTitle(entry)).toBe('Copper Sky');
    expect(queuedLine({ kind: 'plan', position: 1 })).toBe('SCORE PLAN · starts after 1 job'); // no label sent
  });
});
