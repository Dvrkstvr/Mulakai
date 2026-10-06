/** "This one" (F-032, M2-1..M2-3): a strip section or a lyric line as the pick, its sky echo, and what PLAN and
 * REVISE send. */
import { describe, expect, it } from 'vitest';
import type { ScorePlan, ScoreReferent, ScoreSection } from './api';
import type { Section } from './lyricSections';
import { planReferent, reviseReferent, samePick, sectionPick, stripIndexOf, takesPick } from './scoreReferent';
import type { ScoreVerbState } from './scoreVerbTypes';

const SECTIONS: ScoreSection[] = [
  { index: 1, label: 'intro', from_bar: 1, to_bar: 4 }, { index: 2, label: 'verse', from_bar: 5, to_bar: 12 },
  { index: 3, label: 'chorus', from_bar: 13, to_bar: 20 }, { index: 4, label: 'verse', from_bar: 21, to_bar: 28 },
  { index: 5, label: 'chorus', from_bar: 29, to_bar: 36 }, { index: 6, label: 'outro', from_bar: 37, to_bar: 44 },
];
const strip = (...labels: string[]): Section[] => labels.map((label, i) => ({ label, start: i * 10, end: i * 10 + 10 }));
const STRIP = strip('Intro', 'Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Outro');

describe('sectionPick', () => {
  it('meets the score section by kind and occurrence, with its bars and how many there are', () => {
    expect(sectionPick(STRIP, 4, SECTIONS)).toEqual({ kind: 'section', section: 5, label: 'chorus', occurrence: 2, of: 2, bars: [29, 36] });
    expect(sectionPick(STRIP, 1, SECTIONS)).toEqual({ kind: 'section', section: 2, label: 'verse', occurrence: 1, of: 2, bars: [5, 12] });
  });
  it('a strip section the score lacks is missing (rust chip); an untagged lead-in too', () => {
    expect(sectionPick(strip('Spoken Intro', 'Intro'), 0, SECTIONS)).toEqual({ kind: 'missing', label: 'Spoken Intro' });
    expect(sectionPick(strip('Chorus', 'Chorus', 'Chorus'), 2, SECTIONS)).toEqual({ kind: 'missing', label: 'Chorus' });
    expect(sectionPick(strip('', 'Verse'), 0, SECTIONS)).toEqual({ kind: 'missing', label: 'this section' });
  });
  it("takes the server's occurrence when it sends one", () => {
    const sent = SECTIONS.map((x, i) => ({ ...x, occurrence: [1, 1, 1, 2, 2, 1][i] }));
    expect(sectionPick(STRIP, 4, sent)).toEqual({ kind: 'section', section: 5, label: 'chorus', occurrence: 2, of: 2, bars: [29, 36] });
  });
  it('picks nothing while the score sections are not known, or off the strip', () => {
    expect(sectionPick(STRIP, 2, undefined)).toBeNull();
    expect(sectionPick(STRIP, -1, SECTIONS)).toBeNull();
  });
  it('finds the segment a section pick stands on, for the sky echo', () => {
    expect(stripIndexOf(STRIP, SECTIONS, sectionPick(STRIP, 4, SECTIONS))).toBe(4);
    expect(stripIndexOf(STRIP, SECTIONS, null)).toBe(-1);
    expect(stripIndexOf(STRIP, SECTIONS, { kind: 'missing', label: 'x' })).toBe(-1);
  });
});

describe('what PLAN and REVISE send', () => {
  const CHORUS2: ScoreReferent = { kind: 'section', section: 5, label: 'chorus', occurrence: 2, of: 2, bars: [29, 36] };
  const plan = { id: 'p1', referent: CHORUS2 } as ScorePlan;
  it('samePick ignores the numbering extras the server adds', () => {
    expect(samePick({ ...CHORUS2, of: undefined }, CHORUS2)).toBe(true);
    expect(samePick(CHORUS2, { ...CHORUS2, section: 3, occurrence: 1 })).toBe(false);
    expect(samePick(null, undefined)).toBe(true);
    const line = { kind: 'line', block: 2, tag: '[Chorus]', occurrence: 1, of: 2, line: 2, text: 'Copper skies' } as const;
    expect(samePick(line, { ...line, text: 'other', tag: '[chorus]' })).toBe(true);
    expect(samePick(line, { ...line, line: 1 })).toBe(false);
  });
  it('PLAN pins the live pick; a missing section or none sends the whole song', () => {
    expect(planReferent({ pick: CHORUS2 })).toBe(CHORUS2);
    expect(planReferent({ pick: { kind: 'missing', label: 'x' } })).toBeNull();
    expect(planReferent({ pick: null })).toBeNull();
  });
  it('REVISE re-sends the pinned referent unless the pick was changed or cleared (D-070 c)', () => {
    expect(reviseReferent({ plan, pick: { ...CHORUS2, of: undefined } })).toBe(CHORUS2);
    const verse = sectionPick(STRIP, 3, SECTIONS);
    expect(reviseReferent({ plan, pick: verse })).toBe(verse);
    expect(reviseReferent({ plan, pick: null })).toBeNull();
    expect(reviseReferent({ plan: { ...plan, referent: null }, pick: null })).toBeNull();
  });
});

describe('takesPick (review M2 should #2)', () => {
  const status = { sections: SECTIONS, blocks: [] } as unknown as ScoreVerbState['status'];
  it('takes a pick once the sections are read, also with the planner offline', () => {
    expect(takesPick({ phase: { kind: 'asking' }, status })).toBe(true);
    expect(takesPick({ phase: { kind: 'offline', reason: 'x', source: 'planner' }, status })).toBe(true);
  });
  it('lets the click fall through when the song is ineligible or the checker is offline (no sections)', () => {
    expect(takesPick({ phase: { kind: 'ineligible', reason: 'the song has layers' }, status })).toBe(false);
    expect(takesPick({ phase: { kind: 'offline', reason: 'x', source: 'checker' }, status: null })).toBe(false);
    expect(takesPick({ phase: { kind: 'asking' }, status: { ...status!, sections: undefined } })).toBe(false);
  });
});
