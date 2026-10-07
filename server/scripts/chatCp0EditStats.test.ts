import { describe, expect, it } from 'vitest';
import { editMarkdown, editStopLines, joinExcessDb, nullFailed, summarizeEdits, type ApplyResult, type EditResult } from './chatCp0EditStats.js';
import type { TurnResult } from './chatCp0Stats.js';

const turn = (over: Partial<TurnResult> = {}): TurnResult => ({
  index: 0, id: 't', lang: 'en', expect: 'edit', prompt: 'p', postStatus: 202, action: 'edit', cause: null, reasons: [],
  attempts: 1, calls: 1, turnMs: 9000, queuedMs: 0, promptTokens: [3000], unloadMs: 300, vram: null, ...over,
});
const applied = (over: Partial<ApplyResult> = {}): ApplyResult => ({
  postStatus: 202, outcome: 'saved', handoffMs: 200, editMs: 60_000, versionId: 'v2', number: 2, label: 'l', whole: false,
  fallback: null, spliceId: 'sp-1', verdict: 'ok', verdictReason: null, nullTest: { samples: 100, different: 0 },
  seams: [{ out_s: 10, lufs_step: 1, base_lufs_step: 0.5, lufs_step_excess: 0.5 }], check: null, ...over,
});
const edit = (song: string, kind: EditResult['kind'], over: Partial<EditResult> = {}): EditResult => ({
  song, title: song, kind, turn: turn(), planned: { splice: true, kind, from_bar: 9, to_bar: 16 }, apply: applied(), ...over,
});

describe('joinExcessDb / nullFailed', () => {
  it('reads the saved-file check before the splice result; ignores seams with no base counterpart', () => {
    const e = edit('a', 'reharmonize');
    expect(joinExcessDb(e)).toBe(0.5);
    const checked = edit('a', 'reharmonize', { apply: applied({ check: { null_test: { samples: 1, different: 0 }, length_diff_s: 0,
      seams: [{ out_s: 1, lufs_step: -2, base_lufs_step: null, lufs_step_excess: null }, { out_s: 2, lufs_step: -2, base_lufs_step: -0.4, lufs_step_excess: -1.6 }] } }) });
    expect(joinExcessDb(checked)).toBe(1.6);
    expect(joinExcessDb(edit('a', 'cut', { apply: applied({ seams: [{ out_s: 1, lufs_step: 3, base_lufs_step: null, lufs_step_excess: null }] }) }))).toBeNull();
  });
  it('a null test fails on any differing sample in the record or on the saved file', () => {
    expect(nullFailed(edit('a', 'cut'))).toBe(false);
    expect(nullFailed(edit('a', 'cut', { apply: applied({ nullTest: { samples: 9, different: 2 } }) }))).toBe(true);
    expect(nullFailed(edit('a', 'cut', { apply: applied({ check: { null_test: { samples: 9, different: 1 }, seams: [], length_diff_s: 0 } }) }))).toBe(true);
    expect(nullFailed(edit('a', 'rewrite', { apply: applied({ whole: true, nullTest: null, verdict: null }) }))).toBe(false);
  });
});

describe('summarizeEdits + editStopLines', () => {
  it('all pass: p50, worst hand-off, slowest edit per kind, no null fails, join excess on 0 of 3 songs', () => {
    const rs = ['a', 'b', 'c'].flatMap((s) => [edit(s, 'reharmonize'), edit(s, 'cut'), edit(s, 'rewrite', { planned: { splice: false, reason: 'whole' },
      apply: applied({ whole: true, verdict: null, nullTest: null, seams: [], editMs: 200_000 }) })]);
    const s = summarizeEdits(rs);
    expect(s.turnP50S).toBe(9);
    expect(s.byKind.rewrite).toMatchObject({ n: 3, saved: 3, spliced: 0, whole: 3, editMaxS: 200 });
    expect(s.byKind.reharmonize).toMatchObject({ n: 3, spliced: 3, editMaxS: 60 });
    expect(editStopLines(s).map((l) => l.verdict)).toEqual(['PASS', 'PASS', 'PASS', 'PASS', 'PASS']);
  });
  it('STOP: slow turns, a slow hand-off, an edit over 4 min, a failed null test, join excess on 3 of 3 songs', () => {
    const big = (s: string) => edit(s, 'reharmonize', { turn: turn({ turnMs: 20_000, unloadMs: 6000 }),
      apply: applied({ editMs: 250_000, seams: [{ out_s: 1, lufs_step: 2, base_lufs_step: 0, lufs_step_excess: 1.2 }] }) });
    const rs = [big('a'), big('b'), big('c'), edit('c', 'cut', { apply: applied({ nullTest: { samples: 5, different: 1 } }) })];
    const s = summarizeEdits(rs);
    expect(s.excessSongs).toEqual(['a', 'b', 'c']);
    expect(s.nullFails).toEqual(['c cut']);
    expect(editStopLines(s).map((l) => l.verdict)).toEqual(['STOP', 'STOP', 'STOP', 'STOP', 'STOP']);
  });
  it('join excess on 2 of 3 songs passes; nothing measured reads NO DATA', () => {
    const hot = (s: string) => edit(s, 'reharmonize', { apply: applied({ seams: [{ out_s: 1, lufs_step: 2, base_lufs_step: 0, lufs_step_excess: 2 }] }) });
    expect(editStopLines(summarizeEdits([hot('a'), hot('b'), edit('c', 'reharmonize')]))[4].verdict).toBe('PASS');
    expect(editStopLines(summarizeEdits([])).map((l) => l.verdict)).toEqual(['NO DATA', 'NO DATA', 'NO DATA', 'PASS', 'NO DATA']);
  });
  it('the markdown has the stop lines and one row per edit', () => {
    const md = editMarkdown(summarizeEdits([edit('a', 'repeat', { apply: applied({ whole: true, verdict: 'rerender', verdictReason: 'seam +8 dB' }) })]), [
      edit('a', 'repeat', { apply: applied({ whole: true, verdict: 'rerender', verdictReason: 'seam +8 dB' }) })], { server: 's', date: '2026-10-07' });
    expect(md).toContain('## Stop lines');
    expect(md).toMatch(/\| a \| repeat \| edit \|.*rerender: seam \+8 dB/);
  });
});
