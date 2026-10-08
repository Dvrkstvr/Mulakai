/** C1's mark copy (CS-7, CS-8, CS-11): one test per label rule, the chip, the echo and the stale lines. */
import { describe, it, expect } from 'vitest';
import type { RangeMark } from './api/chatAnalysis';
import { USE_BARS, chipText, clock, echoText, markLabel, sectionName, staleChipText, staleLines } from './chatMarkLabel';
import { SECTIONS } from './chatMarkFixture';

const m = (from: number, to: number, seconds: [number, number] = [57.6, 81.6]): RangeMark =>
  ({ kind: 'range', versionId: 'v4', bars: [from, to], seconds });

describe('markLabel (CS-7)', () => {
  it('a whole section is its name; a label that occurs once has no number', () => {
    expect(markLabel(m(7, 10), SECTIONS)).toBe('CHORUS 1');
    expect(markLabel(m(1, 2), SECTIONS)).toBe('INTRO');
    expect(sectionName(SECTIONS[3], SECTIONS)).toBe('VERSE 2');
  });

  it('a section plus bars after it, or bars before it', () => {
    expect(markLabel(m(7, 12), SECTIONS)).toBe('CHORUS 1 + 2 BARS');
    expect(markLabel(m(6, 10), SECTIONS)).toBe('1 BAR + CHORUS 1');
  });

  it('across several sections: first – last', () => {
    expect(markLabel(m(5, 8), SECTIONS)).toBe('VERSE 1 – CHORUS 1');
    expect(markLabel(m(3, 10), SECTIONS)).toBe('VERSE 1 – CHORUS 1');
    expect(markLabel(m(6, 11), SECTIONS)).toBe('VERSE 1 – VERSE 2');
  });

  it('inside one section: the bars; seconds only: the times', () => {
    expect(markLabel(m(8, 9), SECTIONS)).toBe('BARS 8–9');
    expect(markLabel(m(8, 8), SECTIONS)).toBe('BAR 8');
    expect(markLabel({ kind: 'range', versionId: 'v4', seconds: [57.6, 81.6] }, SECTIONS)).toBe('0:58–1:22');
    expect(markLabel(m(8, 9), [])).toBe('BARS 8–9');
  });
});

describe('chip, echo, stale', () => {
  it('the chip: label · bars · seconds, never saying the same thing twice', () => {
    expect(chipText(m(7, 12), SECTIONS)).toBe('THIS: CHORUS 1 + 2 BARS · BARS 7–12 · 0:58–1:22');
    expect(chipText(m(8, 9), SECTIONS)).toBe('THIS: BARS 8–9 · 0:58–1:22');
    expect(chipText({ kind: 'range', versionId: 'v4', seconds: [3, 9.4] }, SECTIONS)).toBe('THIS: 0:03–0:09');
    expect(staleChipText(m(7, 12), SECTIONS)).toBe('THIS: CHORUS 1 + 2 BARS · STALE');
  });

  it('clock rounds to the second', () => {
    expect(clock(57.6)).toBe('0:58');
    expect(clock(81.4)).toBe('1:21');
    expect(clock(-1)).toBe('0:00');
  });

  it('the frozen echo: the server’s label when sent, else computed; the version it was on', () => {
    expect(echoText({ ...m(7, 12), label: 'CHORUS 1 + 2 BARS' }, 4)).toEqual({ text: 'MARKED · CHORUS 1 + 2 BARS · BARS 7–12 · 0:58–1:22', on: 'on v4' });
    expect(echoText(m(7, 10), null, SECTIONS)).toEqual({ text: 'MARKED · CHORUS 1 · BARS 7–10 · 0:58–1:22', on: null });
  });

  it('the stale warning names the old place, where it went when known, and that nothing was sent', () => {
    expect(staleLines(m(25, 34), 4, 5, [33, 42])).toBe(
      'STALE MARK · you marked bars 25–34 of v4. v5 moved them, so they are now bars 33–42. Nothing was sent with the old bars.');
    expect(staleLines(m(25, 34), 4, 5, null)).toBe(
      'STALE MARK · you marked bars 25–34 of v4. v5 moved those bars; mark again. Nothing was sent with the old bars.');
    expect(USE_BARS([33, 42])).toBe('USE BARS 33–42');
    // RT-5 (retime.html B4): the same version, its reading re-timed
    expect(staleLines(m(17, 24), 4, 4, null, false, true)).toBe('STALE MARK · you marked bars 17–24 of v4 on its earlier reading.'
      + ' The reading was re-timed, so every bar number changed; mark again on the new bars. Nothing was sent with the old bars.');
    // C1 live B6: unchanged numbers are not "now" anywhere else
    expect(staleLines(m(15, 22), 5, 6, [15, 22])).toBe(
      'STALE MARK · you marked bars 15–22 of v5. v6 moved other bars; these are still bars 15–22. Nothing was sent with the old bars.');
  });

  it('after a tempo change: the same bars at new times, or mark again for a time-only mark', () => {
    expect(staleLines(m(25, 34), 4, 5, [25, 34], true)).toBe('STALE MARK · you marked bars 25–34 of v4. v5 changed the tempo, '
      + 'so the old times are other music; the bars are the same; use them once its bars are read. Nothing was sent with the old times.');
    expect(staleLines({ kind: 'range', versionId: 'v4', seconds: [30, 45] }, 4, 5, null, true)).toBe('STALE MARK · you marked 0:30–0:45 '
      + 'of v4. v5 changed the tempo, so the old times are other music; mark again. Nothing was sent with the old times.');
  });
});
