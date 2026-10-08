import { describe, it, expect } from 'vitest';
import type { Op } from '../score/planTypes.js';
import { asksToRemove, keepReason, KEEP_REASON, lostDrops } from './reviseKeep.js';

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
