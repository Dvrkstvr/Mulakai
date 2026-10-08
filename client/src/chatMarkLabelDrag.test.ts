/** C1's mark copy for the drag, the chip's tail, the composer line and the echo note (MK-5..MK-7, Q-118). */
import { describe, it, expect } from 'vitest';
import type { RangeMark } from './api/chatAnalysis';
import { chipTail, echoMoved, markConsequence, planMarkLine, sendHeldLine, snapTag, versionNumber } from './chatMarkLabel';

const m = (from: number, to: number, seconds: [number, number]): RangeMark => ({ kind: 'range', versionId: 'v4', bars: [from, to], seconds });
const secs = (a: number, b: number): RangeMark => ({ kind: 'range', versionId: 'v4', seconds: [a, b] });

describe('snapTag (MK-5)', () => {
  it('a snapped edge names its bar line, the time, the bars and the length', () => {
    expect(snapTag(m(25, 34, [57.6, 81.6]), 'end', false, 192)).toBe('SNAPS TO END OF BAR 34 · 1:22 · 10 BARS · 24 s');
    expect(snapTag(m(25, 25, [57.6, 60]), 'start', false, 192)).toBe('SNAPS TO BAR 25 · 0:58 · 1 BAR · 2 s');
  });
  it('Alt frees it to tenths; the song’s ends say so; seconds only: the time and length', () => {
    expect(snapTag(m(25, 35, [57.6, 82.6]), 'end', true, 192)).toBe('FREE · 1:22.6 · SNAP OFF (ALT)');
    expect(snapTag(m(73, 80, [175, 192]), 'end', false, 192)).toBe('END OF SONG · 3:12');
    expect(snapTag(secs(0, 10), 'start', false, 192)).toBe('START OF SONG · 0:00');
    expect(snapTag(secs(62, 82), 'end', false, null)).toBe('1:22 · 20 s');
  });
});

describe('chip tail, composer line, echo note', () => {
  it('a seconds-only chip waits for the reading, or says no bars were read', () => {
    expect(chipTail(true)).toBe(' · BARS WHEN THE READING LANDS');
    expect(chipTail(false)).toBe(' · NO BARS READ');
  });
  it('the consequence names bars or time; a stale mark says which button frees SEND', () => {
    expect(markConsequence(m(1, 2, [0, 4]))).toBe('plans on these bars only · nothing runs until you press APPLY');
    expect(markConsequence(secs(0, 4))).toBe('plans on this time only · nothing runs until you press APPLY');
    expect(sendHeldLine([33, 42])).toBe('SEND IS HELD · press USE BARS or CLEAR MARK');
    expect(sendHeldLine(null)).toBe('SEND IS HELD · press CLEAR MARK, then mark again');
    expect(echoMoved(6)).toBe('v6 MOVED THESE BARS · text only');
  });
  it('the edit card names the mark the plan was bounded to, then the server’s notes', () => {
    expect(planMarkLine({ bars: [47, 62], seconds: [127, 171], notes: ['changes the whole song, not only the marked bars'] }))
      .toBe('PLANNED ON THE MARK · BARS 47–62 · 2:07–2:51 · changes the whole song, not only the marked bars');
    expect(planMarkLine({ bars: null, seconds: [62, 82], notes: [] })).toBe('PLANNED ON THE MARK · 1:02–1:22 · BARS NOT READ');
  });
  it('versionNumber: the playing view first, else the cards', () => {
    const cards = [{ versionId: 'a', body: { number: 1 } }, { versionId: null, body: null }];
    expect(versionNumber('a', cards, null)).toBe(1);
    expect(versionNumber('b', cards, { versionId: 'b', number: 2 })).toBe(2);
    expect(versionNumber('c', cards, null)).toBeNull();
  });
});
