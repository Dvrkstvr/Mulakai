import { describe, it, expect } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
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
    expect(user.content).toContain('LYRIC BLOCKS (block: tag #occurrence):\n1: [Verse] #1, 2 lines, first line: walking out');
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

describe('the M2 ops in the prompt (F-029..F-031)', () => {
  it('gives the op reference for TRANSPOSE, REPEAT / CUT and REWRITE_LYRICS', () => {
    expect(PLANNER_RULES).toContain('- TRANSPOSE {semitones}: move the whole song up (positive) or down (negative), -11..11 semitones, never 0');
    expect(PLANNER_RULES).toContain('- REPEAT {section, label} / CUT {section, label}: play a whole section twice in a row / remove it. '
      + 'section is its S number in SECTIONS');
    expect(PLANNER_RULES).toContain('- REWRITE_LYRICS {block, tag, occurrence, lines}');
    expect(PLANNER_RULES).toContain('lines: exactly as many lines as that block has');
  });

  it('never lets the planner write tags, and keeps every number as read, in the old key (D-064 a, D-066 b)', () => {
    expect(PLANNER_RULES).toContain('Lyric tags such as [Chorus] are written by code: never put a tag in lines or in any other op.');
    expect(PLANNER_RULES).toContain('Every number (bars, sections, blocks, chord and phrase pitches) means the song exactly as the BAR MAP, '
      + 'SECTIONS, KEY NOTES and LYRIC BLOCKS show it now, in the old key, whatever the op order');
  });

  it('names each lyric block "[Chorus] #2" with its number, so "the second chorus" resolves (F-031 #2)', () => {
    const song = contract('read-sections').response.body.facts as ScoreFacts;
    const [, ask] = planMessages(song, 'dark pop', 'rewrite the second chorus about the sea');
    expect(ask.content).toContain('3: [Chorus] #1, 4 lines, first line: chorus 3 line 1');
    expect(ask.content).toContain('5: [Chorus] #2, 4 lines, first line: chorus 5 line 1');
    expect(PLANNER_RULES).toContain('"the second chorus" is the block marked [Chorus] #2');
  });
});

describe('THIS and the pending plan in the prompt (F-032, F-033)', () => {
  it('puts the context lines just before the REQUEST, and nothing for a whole-song PLAN', () => {
    const [, ask] = planMessages(facts, 's', 'make this jazzier', ['THIS: chorus S2 (chorus #1), bars 47-65.', 'PENDING PLAN (plan 1):']);
    expect(ask.content).toContain('THIS: chorus S2 (chorus #1), bars 47-65.\nPENDING PLAN (plan 1):\n\nREQUEST: make this jazzier');
    expect(planMessages(facts, 's', 'r')[1].content).toBe(planMessages(facts, 's', 'r', [])[1].content);
    expect(planMessages(facts, 's', 'r')[1].content).not.toContain('THIS:');
  });

  it('ends with the reply line it is given (a REVISE asks for {drop, ops})', () => {
    expect(planMessages(facts, 's', 'r')[1].content.endsWith('REQUEST: r\nReply with the JSON op list only.')).toBe(true);
    expect(planMessages(facts, 's', 'r', [], 'Reply with {drop, ops} only.')[1].content.endsWith('REQUEST: r\nReply with {drop, ops} only.')).toBe(true);
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

  it("puts a legend before the reasons and a closing line of the caller's (REVISE)", () => {
    const next = retryMessages([], '{}', ['op 2 (SET_TEMPO): x'], { legend: 'Your reply made this plan: op 1 = pending op 1.', closing: 'Close.' });
    expect(next[1].content).toBe('Your op list was rejected:\nYour reply made this plan: op 1 = pending op 1.\n- op 2 (SET_TEMPO): x\nClose.');
  });
});
