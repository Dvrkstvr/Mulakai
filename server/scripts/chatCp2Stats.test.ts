import { describe, expect, it } from 'vitest';
import { judgeRevise, stopLines, summarize, type TurnRecord } from './chatCp2Stats.js';

const tempo = { op: 'SET_TEMPO', bpm: 84 };
const chords = { op: 'REHARMONIZE', from_bar: 9, to_bar: 12, chords: [{ bar: 9, chord: 'Dm7' }] };
const up = { op: 'TRANSPOSE', semitones: 1 };

describe('judgeRevise', () => {
  it('counts a pending op kept when an equal op is in the merged plan (key order does not matter)', () => {
    const j = judgeRevise([tempo, chords], { ops: [{ bpm: 84, op: 'SET_TEMPO' }, chords, up], since: { planId: 'p', marks: [{ mark: 'SAME', was: tempo }, { mark: 'SAME', was: chords }, { mark: 'NEW', was: null }], removed: [] } });
    expect(j).toMatchObject({ kept: 2, changed: 0, removed: 0, lost: [], added: 1, revised: true });
  });
  it('counts a CHANGED op by its `was` and a REMOVED op by the removed list', () => {
    const slower = { op: 'SET_TEMPO', bpm: 80 };
    const j = judgeRevise([tempo, chords], { ops: [slower], since: { planId: 'p', marks: [{ mark: 'CHANGED', was: tempo }], removed: [chords] } });
    expect(j).toMatchObject({ kept: 0, changed: 1, removed: 1, lost: [] });
  });
  it('names a pending op in neither the merged plan nor REMOVED as lost, also when the card is no revise', () => {
    expect(judgeRevise([tempo, chords], { ops: [tempo, up], since: { planId: 'p', marks: [], removed: [] } }).lost).toEqual(['REHARMONIZE 9-12']);
    expect(judgeRevise([tempo, chords], { ops: [up] })).toMatchObject({ revised: false, lost: ['SET_TEMPO', 'REHARMONIZE 9-12'] });
  });
  it('does not let a CHANGED `was` that is not pending hide a loss', () => {
    const j = judgeRevise([tempo], { ops: [up], since: { planId: 'p', marks: [{ mark: 'CHANGED', was: { op: 'SET_TEMPO', bpm: 99 } }], removed: [] } });
    expect(j.lost).toEqual(['SET_TEMPO']);
  });
});

const turn = (o: Partial<TurnRecord>): TurnRecord => ({
  song: 's', id: 'x', kind: 'additive', text: '', marked: false, postStatus: 202, outcome: 'edit', reasons: [], attempts: 1,
  pendingOps: 2, mergedOps: 3, judge: { kept: 2, changed: 0, removed: 0, added: 1, lost: [], revised: true }, promptTokens: [4000],
  contextRefused: false, runMs: 1000, revise: true, ...o,
});

describe('stopLines', () => {
  it('passes a clean run and stops on each line', () => {
    const clean = Array.from({ length: 12 }, () => turn({}));
    expect(stopLines(summarize(clean)).map((l) => l.verdict)).toEqual(['PASS', 'PASS', 'PASS', 'PASS']);
    const bad = [
      ...Array.from({ length: 5 }, () => turn({})),
      turn({ promptTokens: [9000], contextRefused: true }),
      turn({ outcome: 'failed', judge: null }), turn({ outcome: 'failed', judge: null }), turn({ outcome: 'failed', judge: null }), turn({ outcome: 'say', judge: null }),
      ...Array.from({ length: 4 }, () => turn({ judge: { kept: 1, changed: 0, removed: 1, added: 1, lost: [], revised: true } })),
      turn({ kind: 'replace', judge: { kept: 0, changed: 0, removed: 1, added: 1, lost: ['CUT S2'], revised: true } }),
    ];
    expect(stopLines(summarize(bad)).map((l) => l.verdict)).toEqual(['STOP', 'STOP', 'STOP', 'STOP']);
  });
  it('counts an over-6 turn refused with the named limit as met, and the fresh plans not at all', () => {
    const s = summarize([turn({ kind: 'over6', outcome: 'failed', reasons: ['the revised plan has 7 ops; at most 6: drop pending ops or return fewer'], judge: null }), turn({ kind: 'fresh', revise: false, outcome: 'failed', judge: null })]);
    expect(s.revise).toBe(1);
    expect(s.failed).toHaveLength(0);
  });
});
