import { describe, it, expect } from 'vitest';
import type { Op } from '../score/planTypes.js';
import { asksToRemove, keepReason, KEEP_REASON, lostDrops, reviseGuard, START_REASON, startOverReason, startsOver } from './reviseKeep.js';

const TEMPO: Op = { op: 'SET_TEMPO', bpm: 84 };
const HARM: Op = { op: 'REHARMONIZE', from_bar: 23, to_bar: 30, chords: [{ bar: 23, beat: 1, root: 'G', quality: '7' }] };
const UP_1: Op = { op: 'TRANSPOSE', semitones: 1 };

describe('asksToRemove (CP-C2 r2)', () => {
  it('the CP-C2 additions carry no removal intent', () => {
    for (const t of ['and also transpose it up a semitone', 'do the same here: jazz chords', 'also rewrite the lyrics of the second verse about the sea',
      'and also slow it down to 80 BPM', 'and also make the style warmer with soft piano, repeat the last chorus, and add a short guitar phrase in the intro',
      'make it sound cute and sing it slower']) {
      expect(asksToRemove(t), t).toBe(false);
    }
  });

  it('removal and replacement words do, in English, German and Spanish, as whole words or stems', () => {
    for (const t of ['fewer chords: forget the jazz chords in the first chorus, keep the rest', 'forget all that, just transpose it down a tone',
      'remove the tempo change', 'take out the guitar', 'use a minor key instead', 'no jazz chords please', "don't transpose it", 'replaced chords are bad',
      'cut the second chorus', 'only the tempo', 'vergiss die Akkorde', 'Akkorde entfernen', 'quita los acordes', 'sin acordes de jazz']) {
      expect(asksToRemove(t), t).toBe(true);
    }
  });
});

describe('lostDrops / keepReason (CP-C2 r2)', () => {
  it('a drop replaced by a returned op on its target is not lost; one with nothing on its target is', () => {
    expect(lostDrops([TEMPO, HARM], [1, 2], [UP_1])).toEqual([1, 2]);
    expect(lostDrops([TEMPO, HARM], [1], [{ op: 'SET_TEMPO', bpm: 80 }])).toEqual([]);
    expect(lostDrops([TEMPO, HARM], [2, 2], [])).toEqual([2]);
  });

  it('names the reason only for a request without removal words whose drop loses ops', () => {
    expect(keepReason('and also transpose it up a semitone', [TEMPO, HARM], [1, 2], [UP_1]))
      .toBe(`${KEEP_REASON} (your drop removed pending op 1 SET_TEMPO, pending op 2 REHARMONIZE)`);
    expect(keepReason('and also transpose it up a semitone', [TEMPO, HARM], [], [UP_1])).toBeNull();
    expect(keepReason('forget all that, just transpose it down a tone', [TEMPO, HARM], [1, 2], [UP_1])).toBeNull();
    expect(keepReason('and also slow it down to 80 BPM', [TEMPO], [1], [{ op: 'SET_TEMPO', bpm: 80 }])).toBeNull();
  });
});

describe('startsOver / the start-over guard (CP-C2 r3)', () => {
  it('a request to start over, in its own words; a removal of one thing or an addition is not', () => {
    for (const t of ['forget all that, just transpose it down a tone', 'start over: a slow ballad', 'scrap that and make it faster', 'instead of all that, transpose it',
      'from scratch: jazz chords in the chorus', 'forget everything, only 80 BPM', 'never mind all that', 'vergiss das alles, nur schneller', 'olvida todo eso']) {
      expect(startsOver(t), t).toBe(true);
    }
    for (const t of ['fewer chords: forget the jazz chords in the first chorus, keep the rest', 'forget all the jazz chords', 'scrap that chorus',
      'and also transpose it up a semitone', 'remove the tempo change']) {
      expect(startsOver(t), t).toBe(false);
    }
  });

  it('names the pending ops a start-over reply keeps (neither dropped nor replaced on their target); none kept, no reason', () => {
    const req = 'forget all that, just transpose it down a tone';
    const DOWN: Op = { op: 'TRANSPOSE', semitones: -2 };
    expect(startOverReason(req, [TEMPO, UP_1, HARM], [], [DOWN])).toBe(`${START_REASON} (your reply keeps pending op 1 SET_TEMPO, pending op 3 REHARMONIZE)`);
    expect(startOverReason(req, [TEMPO, UP_1, HARM], [1, 3], [DOWN])).toBeNull();
    expect(startOverReason(req, [TEMPO, UP_1, HARM], [1, 2, 3], [DOWN])).toBeNull();
    expect(startOverReason('and also transpose it down a tone', [TEMPO, UP_1], [], [DOWN])).toBeNull();
  });

  it('a start-over without removal words is not bounced by the keep guard; the start guard still fires when it keeps ops (C2 review)', () => {
    const SLOW: Op = { op: 'SET_TEMPO', bpm: 90 };
    for (const t of ['never mind that, set the tempo to 90', 'start again with a slower tempo', 'von vorne, bitte 90 bpm', 'desde cero, a 90 bpm']) {
      expect(startsOver(t), t).toBe(true);
      expect(keepReason(t, [HARM, UP_1], [1, 2], [SLOW]), t).toBeNull();
      expect(reviseGuard(t, [HARM, UP_1], [1, 2], [SLOW], [KEEP_REASON, START_REASON]), t).toBeNull();
      expect(reviseGuard(t, [HARM, UP_1], [], [SLOW], [KEEP_REASON, START_REASON]), t).toMatch(/^this request starts over/);
    }
  });

  it('C2 live B2 (a): a pending op returned unchanged is kept, not replaced; one returned changed on its target is replaced', () => {
    const req = 'scrap that, start over: instead just change the tempo to 80 BPM';
    expect(startOverReason(req, [HARM], [], [HARM])).toBe(`${START_REASON} (your reply keeps pending op 1 REHARMONIZE)`);
    expect(startOverReason(req, [HARM], [1], [HARM])).toBe(`${START_REASON} (your reply keeps pending op 1 REHARMONIZE)`);
    expect(startOverReason(req, [HARM], [1], [{ ...HARM, chords: [{ bar: 23, beat: 1, root: 'C', quality: 'maj7' }] }])).toBeNull();
  });

  it('reviseGuard checks only the unspent guards', () => {
    expect(reviseGuard('and also transpose it up a semitone', [TEMPO], [1], [UP_1], [KEEP_REASON, START_REASON])).toMatch(/^this request adds/);
    expect(reviseGuard('and also transpose it up a semitone', [TEMPO], [1], [UP_1], [START_REASON])).toBeNull();
    expect(reviseGuard('start over: transpose it up', [TEMPO], [], [UP_1], [KEEP_REASON, START_REASON])).toMatch(/^this request starts over/);
    expect(reviseGuard('start over: transpose it up', [TEMPO], [], [UP_1], [])).toBeNull();
  });
});
