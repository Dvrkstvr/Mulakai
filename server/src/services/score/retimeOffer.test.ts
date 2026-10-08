/** Is RE-TIME offered on a song's score (RT-4, D-233): only while it is still the transcription. */
import { describe, it, expect } from 'vitest';
import { decideRetime, EDITED_SINCE, READING_GONE, readBpmOf } from './retimeOffer.js';

const N = 'a'.repeat(64);
const cover = { task_type: 'cover', notationId: N };

describe('decideRetime', () => {
  it('offers it on the cover take itself, with its kept reading', () => {
    expect(decideRetime(cover, [cover])).toEqual({ notationId: N });
  });

  it('offers it again after a version that only re-timed the cover', () => {
    const retimed = { task_type: 'score', ops: [{ op: 'RETIME', bpm: 70 }], retime: { notationId: N } };
    expect(decideRetime(retimed, [cover, retimed])).toEqual({ notationId: N });
  });

  it('refuses after any other SCORE edit, saying the edit would be undone', () => {
    const edited = { task_type: 'score', ops: [{ op: 'RETIME' }, { op: 'SET_TEMPO', bpm: 80 }] };
    expect(decideRetime(edited, [cover, edited])).toEqual({ refused: EDITED_SINCE });
    expect(decideRetime({ task_type: 'repaint' }, [cover])).toEqual({ refused: EDITED_SINCE });
  });

  it('refuses a cover with no kept reading (made before RT, or a malformed id)', () => {
    expect(decideRetime({ task_type: 'cover' }, [{ task_type: 'cover' }])).toEqual({ refused: READING_GONE });
    expect(decideRetime({ task_type: 'cover', notationId: '../x' }, [cover])).toEqual({ refused: READING_GONE });
  });

  it('says nothing for a song that is not a cover (Q-126)', () => {
    expect(decideRetime({ task_type: 'text2music' }, [{ task_type: 'text2music' }])).toBeNull();
    expect(decideRetime(null, [cover])).toBeNull();
  });
});

describe('readBpmOf', () => {
  const beats = (text: string) => ({ files: { 'song_beats.txt': Buffer.from(text).toString('base64') }, chords: false });
  it('reads the median gap of the kept beat list, as yue-server does', () => {
    expect(readBpmOf(beats('0.0\t1\t4\t4\n0.64\t2\t4\t4\n1.28\t3\t4\t4\n1.92\t4\t4\t4\n3.0\t1\t4\t4\n'))).toBe(93.8);
    expect(readBpmOf(beats('0.0\t1\t4\t4\n0.5\t2\t4\t4\n'))).toBe(120);
  });
  it('is null without a usable beat list', () => {
    expect(readBpmOf({ files: {}, chords: false })).toBeNull();
    expect(readBpmOf(beats('0.0\t1\t4\t4\n'))).toBeNull();
  });
});
