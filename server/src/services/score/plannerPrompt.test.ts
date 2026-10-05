import { describe, it, expect } from 'vitest';
import { planMessages, retryMessages } from './plannerPrompt.js';
import { PLANNER_RULES } from './plannerRules.js';
import type { ScoreFacts } from './planTypes.js';

const facts: ScoreFacts = {
  header: { meter: '4/4', unit: '1/32', bpm: 87, key: 'Dm', bars: 65, seconds: 179.3, units_per_quarter: 8 },
  key_notes: 'D E F G A Bb C',
  sections: [{ index: 1, label: 'verse', from_bar: 1, to_bar: 46 }, { index: 2, label: 'chorus', from_bar: 47, to_bar: 65 }],
  lyric_blocks: [{ index: 1, tag: '[Verse]', occurrence: 1, lines: 2, first_line: 'walking out' }],
  bar_map: ['-- S1 verse --', '1: Dm@1 | V:rest | I:0', '2: Dm@1 A7@3 | V:sung | I:4'],
};

describe('planMessages', () => {
  const [system, user] = planMessages(facts, 'dark pop, 90 bpm', 'jazz chords in the chorus');

  it('sends the rules as the system message', () => {
    expect(system).toEqual({ role: 'system', content: PLANNER_RULES });
  });

  it('tells the planner a reharmonization moves roots, not only colours (D-055)', () => {
    expect(PLANNER_RULES).toContain('A reharmonization changes the harmony, not only the chord colour: in every 2 bars of the op, '
      + "at least one chord's root differs from the old chord's root at that bar and beat in the BAR MAP");
    expect(PLANNER_RULES).toContain('ii-V, tritone substitutes, relative minor/major, secondary dominants');
    expect(PLANNER_RULES).toContain('Added 7ths or inversions (slash basses) on the same roots alone are not enough');
  });

  it('tells the song through facts and the bar map, never the raw score', () => {
    expect(user.role).toBe('user');
    expect(user.content).toContain('HEADER: M:4/4 L:1/32 Q:1/4=87 K:Dm; 65 bars, about 179 s');
    expect(user.content).toContain('KEY NOTES (Dm; the key signature already applies the sharps/flats): D E F G A Bb C');
    expect(user.content).toContain('STYLE: dark pop, 90 bpm');
    expect(user.content).toContain('S2 chorus: bars 47-65');
    expect(user.content).toContain('1: [Verse] (occurrence 1 of this tag, 2 lines) first line: walking out');
    expect(user.content).toContain('2: Dm@1 A7@3 | V:sung | I:4');
    expect(user.content).toContain('REQUEST: jazz chords in the chorus');
    expect(user.content).not.toContain('X:1');
  });
});

describe('WRITE_PHRASE in the prompt (F-026, SP-2 notes format)', () => {
  it('says when to use it, where it may go, and how to write a melody as notes', () => {
    expect(PLANNER_RULES).toContain('- WRITE_PHRASE {start_bar, instrument, bars:[[{pitch, beats}, ...], ...]}: only when the user asks for');
    expect(PLANNER_RULES).toContain('inside one range of FREE BARS');
    expect(PLANNER_RULES).toContain('vary the bars');
    expect(PLANNER_RULES).toContain('do not write scales up and down');
    expect(PLANNER_RULES).toContain('KEY NOTES');
    expect(PLANNER_RULES).toContain('beats: the note length in quarter-note beats, one of 0.5 1 1.5 2 3 4');
    expect(PLANNER_RULES).toContain('code adds it to the style');
    expect(PLANNER_RULES).not.toMatch(/ABC string|length is a whole number of units/);
  });

  it('gives N from the request and the free bars from the bar map', () => {
    const [, ask] = planMessages({ ...facts, bar_map: [...facts.bar_map, '3: - | V:rest | I:0'] }, 's', 'add a 2-bar sax phrase');
    expect(ask.content).toContain('PHRASE LENGTH: a WRITE_PHRASE op has exactly 2 bars');
    expect(ask.content).toContain('FREE BARS (the Vocal rests 2 or more bars in a row; a phrase goes only here): none, no 2 bars in a row are free');
    expect(planMessages(facts, 's', 'a sax phrase')[1].content).toContain('PHRASE LENGTH: a WRITE_PHRASE op has exactly 4 bars');
  });
});

describe('retryMessages', () => {
  it('appends the reply and the per-op reasons, asking for a complete corrected list', () => {
    const base = planMessages(facts, 's', 'r');
    const next = retryMessages(base, '{"ops":[]}', ['op 2 (REHARMONIZE): bars 999-999 are outside the score (1-65)']);
    expect(next.slice(0, 2)).toEqual(base);
    expect(next[2]).toEqual({ role: 'assistant', content: '{"ops":[]}' });
    expect(next[3].role).toBe('user');
    expect(next[3].content).toBe('Your op list was rejected:\n- op 2 (REHARMONIZE): bars 999-999 are outside the score (1-65)\n'
      + 'Return a corrected, complete op list as JSON only.');
  });
});
