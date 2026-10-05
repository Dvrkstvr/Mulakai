/** SCORE's "this one" copy (score-m2.html frames 1-4): the chip, its hint, the asking line, FOR, the moved-on
 * note and the stale selection. */
import { describe, expect, it } from 'vitest';
import type { ScorePlan, ScoreReferent, ScoreStaleReferent } from './api';
import {
  askingClause, forClause, movedOnNote, pickPlaceholder, referentName, repickLabel, scoreTarget, staleBody, staleRow,
} from './scoreReferentCopy';

const CHORUS2: ScoreReferent = { kind: 'section', section: 5, label: 'chorus', occurrence: 2, of: 3, bars: [29, 36] };
const VERSE2: ScoreReferent = { kind: 'section', section: 4, label: 'verse', occurrence: 2, of: 2, bars: [21, 28] };
const BRIDGE: ScoreReferent = { kind: 'section', section: 6, label: 'bridge', occurrence: 1, of: 1, bars: [37, 44] };
const LINE = { kind: 'line' as const, block: 4, tag: '[Chorus]', occurrence: 2, of: 3, line: 2, text: 'Copper skies are burning low' };
const STALE: ScoreStaleReferent = { picked: CHORUS2, now: { ...CHORUS2, section: 6, bars: [37, 44] }, reason: 'chorus #2 was bars 29-36 and is now bars 37-44' };

describe('the SCORE chip (M2-1)', () => {
  it('nothing picked: the whole score, and how to pick; a dragged range is ignored here', () => {
    expect(scoreTarget({ pick: null, stale: null }, null)).toMatchObject({ label: 'BASE · WHOLE SCORE', warn: false, clearable: false,
      hint: 'click a section or a lyric line: it becomes “this” in your request' });
    expect(scoreTarget({ pick: null, stale: null }, { start: 92, end: 127 }).hint).toBe('SCORE takes a section or a lyric line · the range 1:32–2:07 is ignored');
  });
  it('no hint when the dock has nothing to pick: no strip section, no timed lyric line (D-074, Q-051)', () => {
    expect(scoreTarget({ pick: null, stale: null }, null, false)).toEqual({ label: 'BASE · WHOLE SCORE', warn: false, clearable: false, hint: '', section: null });
    expect(scoreTarget({ pick: null, stale: null }, null, true).hint).toBe('click a section or a lyric line: it becomes “this” in your request');
  });
  it('a section: its name and bars in the sky suffix, ✕ clears it', () => {
    expect(scoreTarget({ pick: CHORUS2, stale: null }, null)).toEqual({ label: 'BASE · WHOLE SCORE · THIS: CHORUS 2 · BARS 29–36', warn: false,
      clearable: true, hint: '“this” means CHORUS 2 · ✕ clears it', section: null });
    expect(scoreTarget({ pick: BRIDGE, stale: null }, null).label).toBe('BASE · WHOLE SCORE · THIS: BRIDGE · BARS 37–44');
  });
  it('a lyric line: its words, the block named in the hint', () => {
    expect(scoreTarget({ pick: LINE, stale: null }, null)).toMatchObject({ label: 'BASE · WHOLE SCORE · THIS: “COPPER SKIES ARE BURNING LOW”',
      hint: 'line 2 of [Chorus] #2 · ✕ clears it' });
    const long = { ...LINE, text: 'A very long line that goes on and on past the chip width' };
    expect(scoreTarget({ pick: long, stale: null }, null).label).toBe('BASE · WHOLE SCORE · THIS: “A VERY LONG LINE THAT GOES ON AND ON PA…”');
  });
  it('rust for a section the score lacks, and for a stale pick', () => {
    expect(scoreTarget({ pick: { kind: 'missing', label: 'Spoken Intro' }, stale: null }, null)).toMatchObject({
      label: 'BASE · WHOLE SCORE · THIS: SPOKEN INTRO · NOT IN THE SCORE', warn: true, hint: 'pick another section or ✕ clear it' });
    expect(scoreTarget({ pick: CHORUS2, stale: STALE }, null)).toMatchObject({ label: 'BASE · WHOLE SCORE · THIS: CHORUS 2 · STALE', warn: true });
  });
  it('rust for a lyric line no block of the score agrees with: its words, not addressable', () => {
    expect(scoreTarget({ pick: { kind: 'missing', label: 'Hold the night', line: true }, stale: null }, null)).toEqual({
      label: 'BASE · WHOLE SCORE · THIS: “HOLD THE NIGHT” · NOT IN THE SCORE', warn: true, clearable: true,
      hint: 'the score’s lyrics have no such line here · pick another or ✕ clear it', section: null });
  });
});

describe('asking with a pick (frame 2)', () => {
  it('the placeholder and the asking line name it', () => {
    expect(pickPlaceholder(CHORUS2, 'x')).toBe('Describe the change to CHORUS 2, e.g. make this jazzier');
    expect(pickPlaceholder(null, 'x')).toBe('x');
    expect(askingClause(CHORUS2)).toBe(' · “this” means CHORUS 2, bars 29–36');
    expect(askingClause(LINE)).toBe(' · “this” means LINE 2 OF [CHORUS] #2');
    expect(askingClause(null)).toBe('');
  });
});

describe('the plan made for a pick (frame 3, M2-3)', () => {
  const plan = { referent: CHORUS2 } as ScorePlan;
  it('FOR in the header; nothing for the whole song', () => {
    expect(forClause(CHORUS2)).toBe(' · FOR CHORUS 2 (BARS 29–36)');
    expect(forClause({ ...LINE, text: null, section: 5, label: 'chorus', bars: [29, 36] })).toBe(' · FOR LINE 2 OF [CHORUS] #2 (BARS 29–36)');
    expect(forClause(null)).toBe('');
  });
  it('a note once the pick moves on; APPLY keeps what the plan was made for', () => {
    expect(movedOnNote(plan, CHORUS2)).toBeNull();
    expect(movedOnNote(plan, VERSE2)).toBe('planned for CHORUS 2, the selection is now VERSE 2 · APPLY uses CHORUS 2');
    expect(movedOnNote({ referent: null } as ScorePlan, VERSE2)).toBe('planned for THE WHOLE SCORE, the selection is now VERSE 2 · APPLY uses THE WHOLE SCORE');
  });
});

describe('the stale selection (frame 4, M2-4)', () => {
  it('the rejected row, the rust line and USE BARS from where it is now', () => {
    expect(staleRow(STALE)).toBe('CHORUS 2 · not planned: the selection is stale');
    expect(staleBody(STALE)).toBe('you picked CHORUS 2, bars 29–36 · chorus #2 was bars 29-36 and is now bars 37-44 · Nothing was applied.');
    expect(repickLabel(STALE)).toBe('USE BARS 37–44');
    expect(repickLabel({ ...STALE, now: null })).toBeNull();
    expect(referentName({ ...LINE, of: undefined })).toBe('LINE 2 OF [CHORUS] #2');
  });
});
