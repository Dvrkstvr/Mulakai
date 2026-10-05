import { describe, it, expect } from 'vitest';
import { markOps, NO_PENDING, pendingLines, PLAN_REPLACED, PLAN_STALE, reviseRefusal } from './planRevise.js';
import type { Op, Plan } from './planTypes.js';

const TEMPO: Op = { op: 'SET_TEMPO', bpm: 88 };
const HARM_8: Op = { op: 'REHARMONIZE', from_bar: 13, to_bar: 20, chords: [13, 14, 15, 16, 17, 18, 19, 20].map((bar) => ({ bar, beat: 1, root: 'A', quality: 'm7' as const })) };
const HARM_4: Op = { op: 'REHARMONIZE', from_bar: 13, to_bar: 20, chords: [13, 15, 17, 19].map((bar) => ({ bar, beat: 1, root: 'D', quality: 'm7' as const })) };
const STYLE: Op = { op: 'EDIT_STYLE', style: 'dark pop, jazz' };
const plan = (over: Partial<Plan> = {}): Plan => ({
  id: 'p1', songId: 's1', baseVersionId: 'v1', fingerprint: 'f1', request: 'make it jazzier', ops: [TEMPO, HARM_8, STYLE],
  verdicts: [{ index: 1, op: 'SET_TEMPO', ok: true, reason: null }, { index: 2, op: 'REHARMONIZE', ok: true, reason: null },
    { index: 3, op: 'EDIT_STYLE', ok: true, reason: null, note: 'kept the vocal' }],
  abc: '', style: '', checks: { bars: 65, seconds: 179, tokens: 1832, chordsPresent: true, changed: { abc: true, style: true } },
  attempts: 1, refusals: [], createdAt: 0, ...over,
});

describe('markOps (F-033 #1, M2-6)', () => {
  it('marks each op NEW, CHANGED or SAME against the replaced plan and lists the removed ones (mockup frame 7)', () => {
    expect(markOps(plan(), [{ bpm: 88, op: 'SET_TEMPO' } as Op, HARM_4])).toEqual({
      planId: 'p1',
      marks: [{ mark: 'SAME', was: TEMPO }, { mark: 'CHANGED', was: HARM_8 }],
      removed: [STYLE],
    });
  });

  it('calls a different target NEW, and a same-kind op over overlapping bars CHANGED', () => {
    const shifted: Op = { ...HARM_4, from_bar: 15, to_bar: 22 } as Op;
    const repeat: Op = { op: 'REPEAT', section: 3, label: 'chorus' };
    const since = markOps(plan(), [repeat, shifted, { op: 'SET_TEMPO', bpm: 90 }]);
    expect(since.marks.map((m) => m.mark)).toEqual(['NEW', 'CHANGED', 'CHANGED']);
    expect(since.marks[1].was).toEqual(HARM_8);
    expect(since.removed).toEqual([STYLE]);
  });

  it('tells REPEAT from CUT and one section or block from another', () => {
    const prev = plan({ ops: [{ op: 'REPEAT', section: 3, label: 'chorus' }, { op: 'REWRITE_LYRICS', block: 2, tag: '[Chorus]', occurrence: 1, lines: ['a'] }] });
    const since = markOps(prev, [{ op: 'CUT', section: 3, label: 'chorus' }, { op: 'REWRITE_LYRICS', block: 2, tag: '[Chorus]', occurrence: 1, lines: ['b'] },
      { op: 'REWRITE_LYRICS', block: 4, tag: '[Chorus]', occurrence: 2, lines: ['c'] }]);
    expect(since.marks.map((m) => m.mark)).toEqual(['NEW', 'CHANGED', 'NEW']);
    expect(since.removed).toEqual([{ op: 'REPEAT', section: 3, label: 'chorus' }]);
  });
});

describe('pendingLines (D-068)', () => {
  it('shows the planner the pending plan, its verdicts and notes, and asks for a complete replacement on the same numbers', () => {
    const lines = pendingLines(plan({ revision: 2 }));
    expect(lines[0]).toBe('PENDING PLAN (plan 2, made for: "make it jazzier"):');
    expect(lines).toContain('op 1 SET_TEMPO {"bpm":88}: applied');
    expect(lines).toContain('op 3 EDIT_STYLE {"style":"dark pop, jazz"}: applied; note: kept the vocal');
    expect(lines.at(-1)).toBe('The REQUEST below changes this pending plan. Reply with the COMPLETE new op list that replaces it: copy every pending op '
      + 'the request does not change exactly as it is, change or drop the ones it is about, add any new ones. All numbers still mean the song '
      + 'as read above, not as the pending plan would leave it.');
  });
});

describe('reviseRefusal', () => {
  it('refuses with no pending plan, a replaced one or one made on another score; passes the current one', () => {
    expect(reviseRefusal(undefined, 'p1', 'f1')).toBe(NO_PENDING);
    expect(reviseRefusal(plan(), 'p0', 'f1')).toBe(PLAN_REPLACED);
    expect(reviseRefusal(plan(), 'p1', 'f2')).toBe(PLAN_STALE);
    expect(reviseRefusal(plan(), 'p1', 'f1')).toBeNull();
  });
});
