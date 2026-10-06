/** The M2 ops' copy: rows, the lyric diff and the consequence clauses (F-029..F-031; score-m2.html frames 10-12). */
import { describe, expect, it } from 'vitest';
import { consequenceLine, opRows, rowDetail } from './scoreCopy';
import { diffNote, diffRows, keyAfter } from './scoreSectionCopy';
import type { ScoreLyricDiff, ScoreOp, ScorePlan } from './api';

const OLD = ['Hold the light, don’t let it go', 'Copper skies are burning low', 'Carry me back where the river flows', 'Hold the light, don’t let it go'];
const NEW = ['Hold the light, don’t let it go', 'Amber skies are fading slow', 'Carry me home where the rivers run', 'Hold the light, don’t let it go'];
const DIFF: ScoreLyricDiff = { block: 5, tag: '[Chorus]', occurrence: 2, old: OLD, new: NEW };
const TRANSPOSE: ScoreOp = { op: 'TRANSPOSE', semitones: -2 };
const REPEAT: ScoreOp = { op: 'REPEAT', section: 7, label: 'chorus' };
const CUT: ScoreOp = { op: 'CUT', section: 8, label: 'outro' };
const REWRITE: ScoreOp = { op: 'REWRITE_LYRICS', block: 5, tag: '[Chorus]', occurrence: 2, lines: NEW };
const NOTE = 'lyric block 7 [Chorus] is repeated with it';

const plan = (ops: ScoreOp[], ok: boolean[] = ops.map(() => true)): ScorePlan => ({
  id: 'p', songId: 's', baseVersionId: 'v2', request: 'r', ops,
  verdicts: ops.map((o, i) => ({
    index: i + 1, op: o.op, ok: ok[i], reason: ok[i] ? null : 'block 5 is [Verse] occurrence 2, not chorus 2; there is no chorus 2',
    note: o.op === 'REPEAT' ? NOTE : null, diff: o.op === 'REWRITE_LYRICS' && ok[i] ? DIFF : null,
  })),
  style: 'dark pop, 88 bpm',
  checks: { bars: 60, seconds: 170, tokens: 1470, chordsPresent: true, changed: { abc: true, style: false, lyrics: true } },
  attempts: 1, refusals: [], createdAt: 1,
});

describe('keyAfter: the key a TRANSPOSE lands in, named as yue-server names it (D-064 d)', () => {
  it('moves the tonic and keeps the mode', () => {
    expect(keyAfter('Dm', -2)).toBe('Cm');
    expect(keyAfter('Am', -2)).toBe('Gm');
    expect(keyAfter('C', 11)).toBe('B');
  });

  it('takes the fewest accidentals, sharps on a tie', () => {
    expect(keyAfter('E', 4)).toBe('Ab');
    expect(keyAfter('F', 1)).toBe('F#');
    expect(keyAfter('Em', -1)).toBe('D#m');
    expect(keyAfter('Cb', 0)).toBe('B');
  });

  it('is null for a key outside the 30 names or no key', () => {
    expect(keyAfter('Amix', 2)).toBeNull();
    expect(keyAfter('E#', 2)).toBeNull();
    expect(keyAfter(null, 2)).toBeNull();
  });
});

describe('change-list rows for the M2 ops', () => {
  it('TRANSPOSE gives the shift and the key it lands in, and follows', () => {
    const [row] = opRows(plan([TRANSPOSE]), null, 87, 'Dm');
    expect(row).toMatchObject({ name: 'TRANSPOSE', detail: 'down 2 semitones · Dm → Cm · whole song', tag: 'follows' });
    expect(opRows(plan([{ op: 'TRANSPOSE', semitones: 1 }]), null, 87, null)[0].detail).toBe('up 1 semitone · whole song');
  });

  it('REPEAT and CUT name the section by label and S-number, with the lyric note (F-030 #3)', () => {
    const rows = opRows(plan([REPEAT, REPEAT, CUT]), null, 87, 'Am');
    expect(rows.map((r) => r.detail)).toEqual(['CHORUS S7 ×2 · seam un-tied', 'CHORUS S7 ×3 · seam un-tied', 'OUTRO S8 · removed · seam un-tied']);
    expect(rows.map((r) => r.tag)).toEqual(['follows', 'follows', 'follows']);
    expect(rows[0].note).toBe(NOTE);
    expect(rows[2].note).toBeNull();
  });

  it('REWRITE LYRICS names its block, its first line and its line count before apply (F-031 #2), and is a request', () => {
    const [row] = opRows(plan([REWRITE]), null, 87, 'Am');
    expect(row).toMatchObject({ name: 'REWRITE LYRICS', detail: '[Chorus] #2 · starts “Hold the light, don’t let it go” · 4 lines', tag: 'a request' });
    expect(row.diff).toEqual(DIFF);
  });

  it('a refused REWRITE LYRICS has no diff and says why', () => {
    const [row] = opRows(plan([REWRITE], [false]), null, 87, 'Am');
    expect(row.diff).toBeNull();
    expect(rowDetail(row)).toBe('[Chorus] #2 · 4 lines · rejected: block 5 is [Verse] occurrence 2, not chorus 2; there is no chorus 2');
  });
});

describe('the lyric diff (F-031 #1, #3)', () => {
  it('pairs OLD and NEW line by line and marks the changed ones', () => {
    expect(diffRows(DIFF).map((r) => r.changed)).toEqual([false, true, true, false]);
    expect(diffRows(DIFF)[1]).toEqual({ changed: true, old: OLD[1], new: NEW[1] });
  });

  it('says how many lines change and that the whole song re-renders', () => {
    expect(diffNote(DIFF, 2)).toBe('2 of 4 lines change · line count and [Chorus] tag kept · New words change what is sung, '
      + 'so YuE2 re-renders the whole song, not just this chorus. v2 keeps its own words.');
    expect(diffNote({ ...DIFF, tag: '' }, null)).toContain('(untagged) tag kept');
    expect(diffNote(DIFF, null)).not.toContain('keeps its own words');
  });
});

describe('consequence clauses for the M2 ops (D-030/D-031 style)', () => {
  const v = { baseVersion: 2, versions: 2, reading: { key: 'Am' } };

  it('says the key and the structure follow and the new words are a request (mockup frame 10)', () => {
    const line = consequenceLine(plan([{ op: 'SET_TEMPO', bpm: 88 }, TRANSPOSE, REWRITE, REPEAT, CUT]), v, 0);
    expect(line).toBe('Saves base v3 · re-renders the whole song on YuE2, about 3 min · every bar will sound different · '
      + 'tempo follows 88 BPM · the key follows Gm (down 2) · structure follows: chorus S7 repeats once, outro S8 is cut · '
      + 'the new words in [Chorus] #2 are a request to YuE2, not a guarantee · v2 stays in VERSIONS');
  });

  it('counts repeats of one section and says the key shift when the key is unknown', () => {
    const line = consequenceLine(plan([REPEAT, REPEAT, TRANSPOSE]), { ...v, reading: null }, 0);
    expect(line).toContain('the key follows, down 2 semitones · structure follows: chorus S7 repeats twice');
  });

  it('leaves out a refused op and has no section clause for an M0 plan', () => {
    const line = consequenceLine(plan([TRANSPOSE, REWRITE], [true, false]), v, 0);
    expect(line).toContain('the key follows Gm');
    expect(line).not.toContain('new words');
    expect(consequenceLine(plan([{ op: 'SET_TEMPO', bpm: 88 }]), v, 0)).not.toMatch(/key follows|structure follows|new words/);
  });
});
