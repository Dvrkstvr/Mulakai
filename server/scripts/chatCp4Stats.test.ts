import { describe, expect, it } from 'vitest';
import { cp4Markdown, cp4StopLines, joinExcessDb, outcomeOf, partialSave, summarizeCp4, type Cp4Apply, type Cp4Result } from './chatCp4Stats.js';
import type { TurnResult } from './chatCp0Stats.js';

const turn: TurnResult = {
  index: 0, id: 't', lang: 'en', expect: 'edit', prompt: 'p', postStatus: 202, action: 'edit', cause: null, reasons: [],
  attempts: 1, calls: 1, turnMs: 20_000, queuedMs: 0, promptTokens: [], unloadMs: 200, vram: null,
};
const seam = (excess: number | null) => ({ out_s: 10, lufs_step: 1, base_lufs_step: excess === null ? null : 0.5, lufs_step_excess: excess });
const applied = (over: Partial<Cp4Apply> = {}): Cp4Apply => ({
  outcome: 'saved', editMs: 120_000, handoffMs: 20, versionsBefore: 1, versionsAfter: 2, versionId: 'v2', label: 'l',
  record: { splice_v: 2, kind: 'several', bars: [9, 48], steps: [{}, {}] }, fallback: null, spliceId: 's', verdict: 'ok', step: null,
  verdictReason: null, steps: [], nullTest: { samples: 10, different: 0 }, timing: null, tempBytes: 1000, audioLeft: true,
  check: { null_test: { samples: 10, different: 0 }, seams: [seam(0.3), seam(null)], length_diff_s: 0 }, ...over,
});
const card = { splice: true, kind: 'several', steps: [{ kind: 'reharmonize', from_bar: 41, to_bar: 48, ops: [1] }, { kind: 'reharmonize', from_bar: 9, to_bar: 16, ops: [0] }] };
const res = (song: string, over: Partial<Cp4Result> = {}): Cp4Result => ({
  song, title: song, plan: `${song}-p`, mix: 'reharmonize+reharmonize', texts: ['x'], turn, ops: 2, card, apply: applied(), ...over,
});

describe('outcomeOf / partialSave / joinExcessDb', () => {
  it('names a saved chain, a rule fallback (card said whole), an APPLY fallback, no multi-op plan and an unsaved job', () => {
    expect(outcomeOf(res('a'))).toBe('chain');
    expect(outcomeOf(res('a', { card: { splice: false, reason: 'a CUT touches another span' }, apply: applied({ record: null }) }))).toBe('rule');
    expect(outcomeOf(res('a', { apply: applied({ record: { splice_v: 1, fallback: 'not aligned' }, fallback: 'not aligned', verdict: 'rerender' }) }))).toBe('fallback');
    expect(outcomeOf(res('a', { ops: 1, apply: null }))).toBe('no-plan');
    expect(outcomeOf(res('a', { apply: applied({ outcome: 'failed', versionsAfter: 1 }) }))).toBe('unsaved');
  });
  it('a partial save: more than one new version, a version from an unsaved job, a chain record short of the card steps, a v1 splice for a chain card', () => {
    expect(partialSave(res('a'))).toBe(false);
    expect(partialSave(res('a', { apply: applied({ versionsAfter: 3 }) }))).toBe(true);
    expect(partialSave(res('a', { apply: applied({ outcome: 'failed' }) }))).toBe(true);
    expect(partialSave(res('a', { apply: applied({ record: { splice_v: 2, kind: 'several', steps: [{}] } }) }))).toBe(true);
    expect(partialSave(res('a', { apply: applied({ record: { splice_v: 1, kind: 'reharmonize', bars: [9, 16] } }) }))).toBe(true);
    expect(partialSave(res('a', { apply: applied({ record: { splice_v: 1, fallback: 'x' }, fallback: 'x' }) }))).toBe(false);
  });
  it('join excess reads the saved-file check, only joins with a base counterpart', () => {
    expect(joinExcessDb(res('a'))).toBe(0.3);
    expect(joinExcessDb(res('a', { apply: applied({ check: { null_test: { samples: 1, different: 0 }, seams: [seam(-1.4)], length_diff_s: 0 } }) }))).toBe(1.4);
    expect(joinExcessDb(res('a', { apply: applied({ check: null }) }))).toBeNull();
  });
});

describe('summarizeCp4 + cp4StopLines', () => {
  const six = ['a', 'b', 'c'].flatMap((s) => [res(s), res(s, { plan: `${s}-q`, mix: 'reharmonize+cut' })]);
  it('six chains, all clean: every line PASS', () => {
    const lines = cp4StopLines(summarizeCp4(six));
    expect(lines.map((l) => l.verdict)).toEqual(['PASS', 'PASS', 'PASS', 'PASS', 'PASS']);
  });
  it('one differing sample on a saved file, one partial save, excess on 2 of 3 songs, a 5 min 1 s edit, 4 APPLY fallbacks: every line STOP', () => {
    const hot = applied({ check: { null_test: { samples: 9, different: 1 }, seams: [seam(1.2)], length_diff_s: 0 }, editMs: 301_000 });
    const fb = applied({ record: { splice_v: 1, fallback: 'r' }, fallback: 'r', verdict: 'rerender', check: null });
    const rs = [res('a', { apply: hot }), res('b', { apply: applied({ check: { null_test: { samples: 1, different: 0 }, seams: [seam(2)], length_diff_s: 0 }, versionsAfter: 3 }) }),
      res('a', { apply: fb }), res('b', { apply: fb }), res('c', { apply: fb }), res('c', { apply: fb })];
    const s = summarizeCp4(rs);
    expect(s.otherFallbacks).toBe(4);
    expect(cp4StopLines(s).map((l) => l.verdict)).toEqual(['STOP', 'STOP', 'STOP', 'STOP', 'STOP']);
  });
  it('rule fallbacks do not count toward the fallback line; a chain with no saved-file check is NO DATA on the null line', () => {
    const rule = res('a', { card: { splice: false, reason: 'touches' }, apply: applied({ record: null, check: null }) });
    const s = summarizeCp4([rule, rule, rule, rule, res('b', { apply: applied({ check: null }) })]);
    expect(s.otherFallbacks).toBe(0);
    expect(s.ruleFallbacks).toBe(4);
    expect(cp4StopLines(s)[0].verdict).toBe('NO DATA');
  });
  it('markdown has the stop lines and one row per plan', () => {
    const md = cp4Markdown(summarizeCp4(six), six, { server: 's', date: 'd' });
    expect(md).toContain('## Stop lines');
    expect(md.split('\n').filter((l) => l.startsWith('| a ') || l.startsWith('| b ') || l.startsWith('| c '))).toHaveLength(6);
  });
});
