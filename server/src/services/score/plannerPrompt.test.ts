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

  it('tells the song through facts and the bar map, never the raw score', () => {
    expect(user.role).toBe('user');
    expect(user.content).toContain('HEADER: M:4/4 L:1/32 Q:1/4=87 K:Dm; 65 bars, about 179 s');
    expect(user.content).toContain('KEY NOTES (Dm): D E F G A Bb C');
    expect(user.content).toContain('STYLE: dark pop, 90 bpm');
    expect(user.content).toContain('S2 chorus: bars 47-65');
    expect(user.content).toContain('1: [Verse] (occurrence 1 of this tag, 2 lines) first line: walking out');
    expect(user.content).toContain('2: Dm@1 A7@3 | V:sung | I:4');
    expect(user.content).toContain('REQUEST: jazz chords in the chorus');
    expect(user.content).not.toContain('X:1');
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
