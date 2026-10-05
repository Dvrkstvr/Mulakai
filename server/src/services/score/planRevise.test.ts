import { describe, it, expect } from 'vitest';
import { mergeRevise, NO_PENDING, pendingLines, REVISE_LINES, PLAN_REPLACED, PLAN_STALE, reviseRefusal } from './planRevise.js';
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

const HARM_A: Op = { op: 'REHARMONIZE', from_bar: 47, to_bar: 50, chords: [47, 48, 49, 50].map((bar) => ({ bar, beat: 1, root: 'D', quality: 'm7' as const })) };
const UP_2: Op = { op: 'TRANSPOSE', semitones: 2 };
const REPEAT_3: Op = { op: 'REPEAT', section: 3, label: 'chorus' };
const LYRICS_2: Op = { op: 'REWRITE_LYRICS', block: 2, tag: '[Chorus]', occurrence: 1, lines: ['a'] };
const marks = (m: { marks: Array<{ mark: string }> }) => m.marks.map((x) => x.mark);

describe('mergeRevise (D-073, F-033 #1, M2-6)', () => {
  it('keeps every pending op on an additive revision (CP3: "also slow it down to 80 BPM")', () => {
    const m = mergeRevise([HARM_A, UP_2, REPEAT_3, LYRICS_2], [], [{ op: 'SET_TEMPO', bpm: 80 }]);
    expect(m.ops).toEqual([HARM_A, UP_2, REPEAT_3, LYRICS_2, { op: 'SET_TEMPO', bpm: 80 }]);
    expect(marks(m)).toEqual(['SAME', 'SAME', 'SAME', 'SAME', 'NEW']);
    expect(m.marks[4].was).toBeNull();
    expect(m.removed).toEqual([]);
    expect(m.from).toEqual([{ pending: 1 }, { pending: 2 }, { pending: 3 }, { pending: 4 }, { reply: 1 }]);
  });

  it('replaces the pending op on the same target in place: whole-song ops by kind, REHARMONIZE by overlapping bars', () => {
    const shifted: Op = { ...HARM_4, from_bar: 15, to_bar: 22 } as Op;
    const m = mergeRevise([TEMPO, HARM_8, STYLE], [], [shifted, { op: 'SET_TEMPO', bpm: 100 }]);
    expect(m.ops).toEqual([{ op: 'SET_TEMPO', bpm: 100 }, shifted, STYLE]);
    expect(m.marks).toEqual([{ mark: 'CHANGED', was: TEMPO }, { mark: 'CHANGED', was: HARM_8 }, { mark: 'SAME', was: STYLE }]);
    expect(m.from).toEqual([{ pending: 1, reply: 2 }, { pending: 2, reply: 1 }, { pending: 3 }]);
  });

  it('drops the listed pending ops and lists them removed', () => {
    const m = mergeRevise([TEMPO, HARM_8, STYLE], [3, 1], []);
    expect(m.ops).toEqual([HARM_8]);
    expect(marks(m)).toEqual(['SAME']);
    expect(m.removed).toEqual([TEMPO, STYLE]);
  });

  it('tells REPEAT from CUT and one block from another; a phrase is the same target by its start bar', () => {
    const phrase = (start_bar: number, pitch: string): Op => ({ op: 'WRITE_PHRASE', start_bar, instrument: 'sax', bars: [[{ pitch, beats: 4 }]] });
    const cut: Op = { op: 'CUT', section: 3, label: 'chorus' };
    const lyricsB: Op = { ...LYRICS_2, lines: ['b'] } as Op;
    const block4: Op = { op: 'REWRITE_LYRICS', block: 4, tag: '[Chorus]', occurrence: 2, lines: ['c'] };
    const m = mergeRevise([REPEAT_3, LYRICS_2, phrase(57, 'D')], [], [cut, lyricsB, block4, phrase(57, 'F'), phrase(59, 'A')]);
    expect(m.ops).toEqual([REPEAT_3, lyricsB, phrase(57, 'F'), cut, block4, phrase(59, 'A')]);
    expect(marks(m)).toEqual(['SAME', 'CHANGED', 'CHANGED', 'NEW', 'NEW', 'NEW']);
  });

  it("calls an identical returned op SAME, and an op on a dropped op's target NEW with the dropped one removed", () => {
    expect(marks(mergeRevise([TEMPO, STYLE], [], [{ bpm: 88, op: 'SET_TEMPO' } as Op]))).toEqual(['SAME', 'SAME']);
    const m = mergeRevise([TEMPO, STYLE], [1], [{ op: 'SET_TEMPO', bpm: 70 }]);
    expect(m.ops).toEqual([STYLE, { op: 'SET_TEMPO', bpm: 70 }]);
    expect(marks(m)).toEqual(['SAME', 'NEW']);
    expect(m.removed).toEqual([TEMPO]);
  });

  it('replaces a pending op once: a second op on its target is added; one REHARMONIZE over two pending ones removes the second', () => {
    expect(mergeRevise([TEMPO], [], [{ op: 'SET_TEMPO', bpm: 90 }, { op: 'SET_TEMPO', bpm: 95 }]).ops)
      .toEqual([{ op: 'SET_TEMPO', bpm: 90 }, { op: 'SET_TEMPO', bpm: 95 }]);
    const later: Op = { ...HARM_8, from_bar: 21, to_bar: 28 } as Op;
    const wide: Op = { ...HARM_4, from_bar: 13, to_bar: 28 } as Op;
    const m = mergeRevise([HARM_8, STYLE, later], [], [wide]);
    expect(m.ops).toEqual([wide, STYLE]);
    expect(m.marks[0]).toEqual({ mark: 'CHANGED', was: HARM_8 });
    expect(m.removed).toEqual([later]);
  });
});

describe('pendingLines (D-068)', () => {
  it('numbers the pending ops with their verdicts and notes, and asks for only what changes as {drop, ops} (D-073)', () => {
    const lines = pendingLines(plan({ revision: 2 }));
    expect(lines[0]).toBe('PENDING PLAN (plan 2, made for: "make it jazzier"):');
    expect(lines).toContain('op 1 SET_TEMPO {"bpm":88}: applied');
    expect(lines).toContain('op 3 EDIT_STYLE {"style":"dark pop, jazz"}: applied; note: kept the vocal');
    expect(lines.slice(4)).toEqual(REVISE_LINES);
    expect(REVISE_LINES.join(' ')).toContain('return only what changes');
    expect(REVISE_LINES.join(' ')).toContain("list a pending op's number in drop to remove it");
    expect(REVISE_LINES.join(' ')).toContain('everything else stays as it is');
    expect(REVISE_LINES.at(-1)).toMatch(/not as the pending plan would leave it\.$/);
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
