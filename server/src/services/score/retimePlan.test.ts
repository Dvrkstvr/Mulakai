/** RE-TIME as a SCORE plan made without the planner (RT-4, F-093). */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeRetimePlan, RetimePlanRefused, type RetimePlanDeps } from './retimePlan.js';
import { getPlan, resetPlans } from './planStore.js';
import { renderRefusal } from './scoreRenderCheck.js';
import type { ApplyResult } from './planTypes.js';
import type { ScoreStatus } from './scoreStatus.js';

const N = 'b'.repeat(64);
const FACTS = {
  header: { meter: '4/4', unit: '1/32', bpm: 94, key: 'Gm', bars: 71, seconds: 179, units_per_quarter: 8 },
  key_notes: '', sections: [{ index: 1, label: 'verse', from_bar: 1, to_bar: 71 }], lyric_blocks: [], bar_map: [],
};
const status = (over: Partial<ScoreStatus> = {}): ScoreStatus => ({
  eligibility: { state: 'eligible' },
  source: { songId: 's1', activeVersionId: 'v1', abc: 'X:1 sung', style: 'pop', lyrics: '[verse]\nla', fingerprint: 'fp', seed: 7 } as never,
  read: { facts: FACTS, chordsPresent: false } as never,
  ...over,
});
const sized = (over: Partial<ApplyResult> = {}): ApplyResult => ({
  ok: true, abc: 'X:1 rebuilt', style: 'pop', lyrics: '[verse]\nla', verdicts: [{ index: 0, op: 'SET_TEMPO', ok: true, reason: null }],
  checks: { ok: true, problems: [], differences: [] }, changed: { abc: false, style: false }, sections: null, chords_present: false,
  bpm: 47, seconds: 182, tokens: 1300, ...over,
});

function deps(over: Partial<RetimePlanDeps> = {}): RetimePlanDeps {
  return {
    status: vi.fn(async () => status()),
    offer: vi.fn(async () => ({ state: 'offered' as const, notationId: N, readBpm: 93.7 })),
    load: vi.fn(async () => ({ files: { 'song_beats.txt': 'x' }, chords: false })),
    retime: vi.fn(async () => ({
      abc: 'X:1 rebuilt', measures: 36, bpm: 47, readBpm: 93.7, vocalNotes: 300, insNotes: 60, notes: 488, droppedNotes: 112, leftOut: ['intro'], warnings: [],
    })),
    apply: vi.fn(async () => sized()),
    ...over,
  };
}

afterEach(() => resetPlans());

describe('makeRetimePlan', () => {
  it('rebuilds from the kept reading keeping the sections the cover sings, sizes it, and stores one RETIME op', async () => {
    const d = deps();
    const plan = await makeRetimePlan('s1', 'half', 99, d);
    expect(d.retime).toHaveBeenCalledWith({ files: { 'song_beats.txt': 'x' }, chords: false }, 'half', null, 'X:1 sung');
    expect(d.apply).toHaveBeenCalledWith({ abc: 'X:1 rebuilt', style: 'pop', lyrics: '[verse]\nla' }, [{ op: 'SET_TEMPO', bpm: 47 }]);
    expect(plan).toMatchObject({
      songId: 's1', baseVersionId: 'v1', fingerprint: 'fp', abc: 'X:1 rebuilt', request: 'RE-TIME HALF TIME · 93.7 → 47 BPM',
      ops: [{ op: 'RETIME', mode: 'half', bpm: 47, from_bpm: 93.7, dropped_notes: 112, notes: 488 }],
      verdicts: [{ index: 0, op: 'RETIME', ok: true, reason: null }], attempts: 0,
      checks: { seconds: 182, tokens: 1300 }, retime: { notationId: N, readBpm: 93.7 },
    });
    expect(getPlan('s1')?.id).toBe(plan.id);
  });

  it('sends a BPM only in bpm mode', async () => {
    const d = deps();
    await makeRetimePlan('s1', 'bpm', 80, d);
    expect(d.retime).toHaveBeenCalledWith(expect.anything(), 'bpm', 80, 'X:1 sung');
  });

  it('is an ordinary plan APPLY & RENDER accepts', async () => {
    const plan = await makeRetimePlan('s1', 'double', null, deps());
    expect(renderRefusal({ songId: 's1', eligibility: { state: 'eligible' }, plan, source: status().source, pendingEdit: null, loaded: [] } as never)).toBeNull();
  });

  it('refuses with the reason, making no plan, when it is not offered or the reading is gone', async () => {
    const edited = deps({ offer: async () => ({ state: 'refused', reason: 'edited since' }) });
    await expect(makeRetimePlan('s1', 'half', null, edited)).rejects.toMatchObject({ status: 409, message: 'edited since' });
    const gone = deps({ load: async () => null });
    await expect(makeRetimePlan('s1', 'half', null, gone)).rejects.toMatchObject({ status: 409, code: 'no_bundle' });
    const none = deps({ offer: async () => ({ state: 'none' }) });
    await expect(makeRetimePlan('s1', 'half', null, none)).rejects.toBeInstanceOf(RetimePlanRefused);
    expect(getPlan('s1')).toBeUndefined();
  });

  it('refuses an ineligible song and a re-timed score that does not check', async () => {
    const off = deps({ status: async () => status({ eligibility: { state: 'ineligible', reason: 'no chords' } as never }) });
    await expect(makeRetimePlan('s1', 'half', null, off)).rejects.toMatchObject({ status: 409, message: 'no chords' });
    const over = deps({ apply: async () => sized({ ok: false, checks: { ok: false, problems: ['over the 4096-token budget'], differences: [] } }) });
    await expect(makeRetimePlan('s1', 'half', null, over)).rejects.toMatchObject({ status: 422, message: /over the 4096-token budget/ });
  });
});
