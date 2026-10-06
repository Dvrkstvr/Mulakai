import { describe, it, expect } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
import { RECIPE, facts206 } from '../../../test-fakes/chatScripts.js';
import { recipeFields } from './draftModel.js';
import { LIBRARY_MAX, PENDING_MAX, draftLines, fieldLines, songStateLines } from './songState.js';
import type { ScoreFacts } from '../score/planTypes.js';

const facts = contract('read-ok').response.body.facts as ScoreFacts;
const song = {
  title: 'Night Drive', style: 'synthwave, male voice, 176 bpm, D major, 6/8 time',
  versions: [{ number: 1, label: 'first generation', active: false }, { number: 2, label: 'score edit', active: true }], facts, reason: null,
};

describe('song-state block (SP-5 song_block, v3.1 + run-length bar map)', () => {
  it('a draft thread: library titles (at most 50) and "SONG: none yet", nothing else', () => {
    const library = Array.from({ length: 60 }, (_, i) => `Song ${i}`);
    expect(songStateLines({ library, song: null })).toEqual([
      `LIBRARY (song titles): ${library.slice(0, LIBRARY_MAX).join('; ')}`,
      'SONG: none yet (this thread is a draft; nothing has been created)',
    ]);
  });

  it('a song thread: title, versions with labels, the HEADER key in words, the style without its hints, sections, blocks', () => {
    const text = songStateLines({ library: [], song }).join('\n');
    expect(text).toContain('SONG: "Night Drive" · active v2 of 2 · engine YuE2 (score-editable)');
    expect(text).toContain('VERSIONS: v1 first generation · v2 score edit (active)');
    expect(text).toContain('HEADER: M:4/4 L:1/32 Q:1/4=87 K:Dm (D minor); 65 bars, about 179 s (the hard limit is 360 s)');
    expect(text).toContain('STYLE (a description only; its bpm or key words may be stale, the HEADER is true): synthwave, male voice\n');
    expect(text).toContain(`SECTIONS:\nS1 ${facts.sections[0].label}: bars 1-10`);
    expect(text).toContain('LYRIC BLOCKS (block: tag #occurrence):\n1: [Verse] #1, 2 lines, first line: walking out');
  });

  it('the bar map is run-length encoded, with the legend', () => {
    const text = songStateLines({ library: [], song }).join('\n');
    expect(text).toContain('BAR MAP (bar: chords@beat | vocal | number of Ins notes; "a-b:" = the same for every bar a to b):\n-- S1 intro --');
    expect(text).toContain('\n3-4: Dm@1 | V:rest | I:8\n');
    expect(text).not.toContain('\n4: Dm@1');
  });

  it('a song whose score cannot be read says why and sends no facts', () => {
    const text = songStateLines({ library: [], song: { ...song, facts: null, reason: 'yue-server did not answer' } }).join('\n');
    expect(text).toContain('SCORE: cannot be read (yue-server did not answer)');
    expect(text).not.toContain('BAR MAP');
    expect(text).not.toContain('score-editable');
  });

  it('the 206-bar song stays under 6k tokens at 3 characters a token (F-042 #2)', () => {
    const text = songStateLines({ library: Array.from({ length: 50 }, (_, i) => `A library song title ${i}`), song: { ...song, facts: facts206() } }).join('\n');
    expect(text.length / 3).toBeLessThan(6000);
  });

  it('fieldLines leaves out what is not filled', () => {
    expect(fieldLines({ title: 'X', bpm: 90 })).toEqual(['title: X', 'bpm 90']);
  });
});

describe('the draft in the prompt (SP-5 fmt_pending)', () => {
  it('a live recipe card is the PENDING PROPOSAL, as its fields and "[Tag] line / line"', () => {
    const lines = draftLines(recipeFields(RECIPE), true);
    expect(lines[0]).toBe('PENDING PROPOSAL (the new-song card the person is looking at; nothing has run):');
    expect(lines).toContain('title: Luz sobre el mar');
    expect(lines).toContain('bpm 68 · key Am · time 4/4 · language es · engine yue2');
    expect(lines).toContain('[Chorus] Mar, llévame despacio / donde duerme el sol / mar, abre tu espacio / para mi canción');
  });

  it('fields without a live card are the sidebar as the person left it; an empty draft is nothing', () => {
    expect(draftLines({ title: 'X' }, false)).toEqual(['SIDEBAR (the new-song fields as they are now; the person may have edited them by hand):', 'title: X']);
    expect(draftLines({}, true)).toEqual([]);
    expect(draftLines(null, true)).toEqual([]);
  });

  it('a hand-typed draft is cut to the pending budget (1.2k tokens)', () => {
    const long = { lyrics: Array.from({ length: 10 }, () => ({ tag: 'Verse', lines: Array(8).fill('x'.repeat(100)) })) };
    expect(draftLines(long, false).join('\n').length).toBeLessThanOrEqual(PENDING_MAX + 1);
  });
});
