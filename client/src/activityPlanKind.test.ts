/** The server's queue gains a `plan` kind (score planner, F-019 #5) that the client's kind union
 * does not name yet (the SCORE verb arrives in W3). A running or queued plan must still map to a
 * plain row in Activity and the Header's `/active` poll, not break them. */
import { describe, it, expect } from 'vitest';
import type { ActiveGeneration, QueueEntry } from './api';
import { runningRows, type RunningSources } from './activityRunning';
import { queuedLine, queuedTitle } from './queueCopy';

const idle = (over: Partial<RunningSources> = {}): RunningSources => ({
  genJobs: [], editorJobs: [], splitJob: null,
  transcribe: { stage: 'idle' }, readLyrics: { stage: 'idle' }, timings: {}, active: null, ...over,
});

// What GET /api/generate/active sends while a plan holds the slot.
const plan = { kind: 'plan', jobId: 'p1', songId: 's1', title: 'Copper Sky', startedAt: 5, status: 'running' } as unknown as ActiveGeneration;

describe('a running plan in Activity (F-019 #5)', () => {
  it('maps to one generic, plain row that ABORT can reach', () => {
    const rows = runningRows(idle({ active: plan }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: 'active:p1', jobId: 'p1', songId: 's1', title: 'Copper Sky', startedAt: 5, ai: false, abortable: true });
    expect(rows[0].label === undefined || typeof rows[0].label === 'string').toBe(true);
  });

  it('drops out once the poll says it settled', () => {
    expect(runningRows(idle({ active: { ...plan, status: 'done' } }))).toEqual([]);
    expect(runningRows(idle({ active: plan, settledIds: new Set(['p1']) }))).toEqual([]);
  });

  it('reads as an UP NEXT row while it waits in the queue (the server labels it)', () => {
    const entry = { kind: 'plan', jobId: 'p1', songId: 's1', title: 'Copper Sky', label: 'score plan', position: 2 } as unknown as QueueEntry;
    expect(queuedLine(entry)).toBe('SCORE PLAN · starts after 2 jobs');
    expect(queuedTitle(entry)).toBe('Copper Sky');
  });
});
