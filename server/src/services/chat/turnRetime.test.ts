/** resolveRetime's dock route (RT-6, F-094): the dock's plan carries the planner's tries, and on a start over over a
 * pending plan (D-265) the revise's `since` (every pending op REMOVED) and revision n+1, as any revise card. */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-turnretime-test-'));

const { resolveRetime } = await import('./turnRetime.js');
type Plan = import('../score/planTypes.js').Plan;
type EditBase = import('./editTypes.js').EditBase;
type RetimeDeps = import('./turnRetime.js').RetimeDeps;

const base = { songId: 's1', source: { abc: 'X:1', style: '', lyrics: null, activeVersionId: 'v1', fingerprint: 'f1' }, facts: {}, chordsPresent: true } as unknown as EditBase;
const plan = { id: 'p2', ops: [{ op: 'RETIME', mode: 'half' }], attempts: 0, refusals: [] } as unknown as Plan;
const deps = { facts: async () => { throw new Error('unused'); }, plan: async () => plan, reading: {} } as unknown as RetimeDeps;
const route = { kind: 'dock', mode: 'half', bpm: null, readBpm: 140 } as const;

describe('resolveRetime (dock)', () => {
  it('a fresh plan: the planner\'s tries on it, no since', async () => {
    const r = await resolveRetime(route, 's1', base, { attempts: 2, refusals: [['x']] }, deps);
    expect(r).toMatchObject({ kind: 'dock', plan: { id: 'p2', attempts: 2, refusals: [['x']] } });
    expect((r as { plan: Plan }).plan.since).toBeUndefined();
  });

  it('a start over over a pending plan: since lists the pending ops REMOVED, revision n+1', async () => {
    const since = { planId: 'p1', marks: [{ mark: 'NEW' as const, was: null }], removed: [{ op: 'SET_TEMPO', bpm: 90 }] as never[] };
    const r = await resolveRetime(route, 's1', base, { attempts: 1, refusals: [], since, revision: 2 }, deps);
    expect(r).toMatchObject({ kind: 'dock', plan: { since, revision: 2 } });
  });
});
