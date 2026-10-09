/** Where a chat RE-TIME request goes (RT-6 prep, F-094; retime.html D1-D5, Q-125): the dock's plan, the reading,
 * SET TEMPO when only slightly off, or a refusal with the reason. */
import { describe, it, expect } from 'vitest';
import { routeRetime, type VerbFacts } from './retimeVerb.js';
import { EDITED_SINCE, READING_GONE } from '../score/retimeOffer.js';

const COVER: VerbFacts = { dock: { state: 'offered', notationId: 'n1', readBpm: 140 }, reading: null };
const READING: VerbFacts = { dock: { state: 'none' }, reading: { notationId: 'n2', read: { bpm: 87, bars: 65 }, retimed: null } };

describe('routeRetime', () => {
  it('D1: a cover still on its transcription re-times in the dock (YuE2 re-renders)', () => {
    expect(routeRetime({ mode: 'half' }, COVER)).toEqual({ kind: 'dock', mode: 'half', bpm: null, readBpm: 140 });
  });

  it('D2: a named BPM far from the read is a re-time', () => {
    expect(routeRetime({ mode: 'bpm', bpm: 92 }, COVER)).toEqual({ kind: 'dock', mode: 'bpm', bpm: 92, readBpm: 140 });
  });

  it('D3: a BPM within 8 % of the read is SET TEMPO, with the why (Q-125); HALF and DOUBLE never are', () => {
    expect(routeRetime({ mode: 'bpm', bpm: 143 }, COVER)).toEqual({
      kind: 'set_tempo', bpm: 143, readBpm: 140, why: '143 is within 8 % of the 140 read: the beat is right, so this is a tempo change, not a re-time',
    });
    expect(routeRetime({ mode: 'bpm', bpm: 151 }, COVER).kind).toBe('set_tempo'); // 7.9 %
    expect(routeRetime({ mode: 'bpm', bpm: 152 }, COVER).kind).toBe('dock');
  });

  it("a song that is not a cover re-times its playable version's transcribed reading (F-092: no render)", () => {
    expect(routeRetime({ mode: 'double' }, READING)).toEqual({ kind: 'reading', mode: 'double', bpm: null, readBpm: 87 });
  });

  it('a slight BPM on a reading only is refused: a reading has no SET TEMPO, and the beat is right', () => {
    expect(routeRetime({ mode: 'bpm', bpm: 90 }, READING)).toEqual({
      kind: 'refused', reason: '90 is within 8 % of the 87 read: the beat is right, and RE-TIME is for a wrong beat · nothing changed',
    });
  });

  it('asked about the reading on a cover, the reading is re-timed when it has one; with none, the dock (D-280)', () => {
    expect(routeRetime({ mode: 'half' }, { ...COVER, reading: READING.reading }, 'reading')).toMatchObject({ kind: 'reading', readBpm: 87 });
    expect(routeRetime({ mode: 'half' }, COVER, 'reading')).toMatchObject({ kind: 'dock' });
  });

  it.each([
    ['D5: the kept reading is gone (dock)', { dock: { state: 'refused', reason: READING_GONE }, reading: null } as VerbFacts, READING_GONE],
    ['the cover was edited since (D-240)', { dock: { state: 'refused', reason: EDITED_SINCE }, reading: null } as VerbFacts, EDITED_SINCE],
    ['a reading with no kept outputs', { dock: { state: 'none' }, reading: { ...READING.reading!, notationId: null } } as VerbFacts,
      'the saved reading is gone: TRANSCRIBE AGAIN under the reading line, then ask again'],
    ["a YuE2 song's own score", { dock: { state: 'none' }, reading: null } as VerbFacts,
      "this song's score is what YuE2 rendered, so its beat is right by construction: SET TEMPO changes its tempo"],
  ])('refuses %s, with the reason', (_, facts, reason) => {
    expect(routeRetime({ mode: 'half' }, facts)).toEqual({ kind: 'refused', reason });
  });

  it('a target outside 40-240 is refused with the limit, before anything runs (Q-129)', () => {
    expect(routeRetime({ mode: 'half' }, { ...COVER, dock: { state: 'offered', notationId: 'n1', readBpm: 70 } }))
      .toEqual({ kind: 'refused', reason: 'HALF is off: 35 BPM is under the limit · nothing changed. Did you mean double time (70 → 140 BPM)? Say "double time"' });
    expect(routeRetime({ mode: 'bpm', bpm: 300 }, COVER)).toEqual({ kind: 'refused', reason: '300 BPM is outside 40-240' });
  });

  it('RT-6 re-check 3: a HALF or DOUBLE off the limits names the other mode when it fits, in code; never flips it', () => {
    const cover = { ...COVER, dock: { state: 'offered', notationId: 'n1', readBpm: 146.3 } } as VerbFacts;
    expect(routeRetime({ mode: 'double' }, cover)).toEqual({ kind: 'refused',
      reason: 'DOUBLE is off: 293 BPM is over the limit · nothing changed. Did you mean half time (146 → 73 BPM)? Say "half time"' });
    const eventide = { ...READING, reading: { ...READING.reading!, read: { bpm: 65, bars: 80 } } } as VerbFacts;
    expect(routeRetime({ mode: 'half' }, eventide)).toEqual({ kind: 'refused',
      reason: 'HALF is off: 33 BPM is under the limit · nothing changed. Did you mean double time (65 → 130 BPM)? Say "double time"' });
  });

  it('no suggestion when the other mode is off too, or for a named BPM', () => {
    const fast = { ...COVER, dock: { state: 'offered', notationId: 'n1', readBpm: 500 } } as VerbFacts;
    expect(routeRetime({ mode: 'double' }, fast)).toEqual({ kind: 'refused', reason: 'DOUBLE is off: 1000 BPM is over the limit' });
    const slow = { ...READING, reading: { ...READING.reading!, read: { bpm: 15, bars: 8 } } } as VerbFacts;
    expect(routeRetime({ mode: 'half' }, slow)).toEqual({ kind: 'refused', reason: 'HALF is off: 8 BPM is under the limit' });
    expect(routeRetime({ mode: 'bpm', bpm: 20 }, READING)).toEqual({ kind: 'refused', reason: '20 BPM is outside 40-240' });
  });
});
