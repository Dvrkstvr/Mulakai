/** planBuild: an applied result -> the pending Plan, the one shape the dock and the chat share (C0b, CB-2). */
import { describe, it, expect } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
import { buildPlan, type PlanBuildInput } from './planBuild.js';
import type { ApplyResult, Op, ScoreFacts } from './planTypes.js';

const facts = contract('read-ok').response.body.facts as ScoreFacts;
const applied = contract('apply-reharmonize').response.body as ApplyResult;
const ops: Op[] = [{ op: 'REHARMONIZE', from_bar: 47, to_bar: 54, chords: [{ bar: 47, beat: 1, root: 'G', quality: 'm7' }] }];
const input: PlanBuildInput = {
  id: 'p1', createdAt: 1000, songId: 's1', source: { activeVersionId: 'v1', fingerprint: 'l1|v1|v1' }, request: 'jazz chords in the chorus',
  facts, chordsPresent: true, ops, applied, attempts: 2, refusals: [['bar 999 is outside the song']],
};

describe('planBuild (pure)', () => {
  it('copies the applied score, the checks and the render mode into a Plan', () => {
    expect(buildPlan(input)).toEqual({
      id: 'p1', songId: 's1', baseVersionId: 'v1', fingerprint: 'l1|v1|v1', request: 'jazz chords in the chorus',
      ops, verdicts: applied.verdicts, abc: applied.abc, style: applied.style, lyrics: applied.lyrics,
      checks: { bars: 65, seconds: 179.3, tokens: 1836, chordsPresent: true, changed: applied.changed },
      attempts: 2, refusals: [['bar 999 is outside the song']], createdAt: 1000,
      referent: null, revision: 1, since: null, renderMode: { cot: 'full', reason: 'chords' },
    });
  });

  it('a chord-free score with a REHARMONIZE renders with chords; null lyrics stay null; a REVISE keeps its revision and since', () => {
    const since = { planId: 'p0', marks: [], removed: [] };
    const plan = buildPlan({ ...input, chordsPresent: false, applied: { ...applied, lyrics: undefined }, revision: 3, since });
    expect(plan).toMatchObject({ renderMode: { cot: 'full', reason: 'reharmonize' }, lyrics: null, revision: 3, since });
  });
});
