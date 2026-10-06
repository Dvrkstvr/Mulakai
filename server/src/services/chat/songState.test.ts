import { describe, it, expect } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
import { RECIPE, facts206 } from '../../../test-fakes/chatScripts.js';
import { recipeFields } from './draftModel.js';
import { LIBRARY_MAX, fieldLines, songStateLines } from './songState.js';
import type { ScoreFacts } from '../score/planTypes.js';

const facts = contract('read-ok').response.body.facts as ScoreFacts;
const song = { title: 'Night Drive', style: 'synthwave, male voice', versions: [{ number: 1, label: 'first generation', active: false }, { number: 2, label: 'score edit', active: true }], facts, reason: null };

describe('song-state block (SP-5 song_block)', () => {
  it('a draft thread: library titles (at most 50), no song, and the sidebar as it is', () => {
    const library = Array.from({ length: 60 }, (_, i) => `Song ${i}`);
    const text = songStateLines({ library, draft: recipeFields(RECIPE), song: null }).join('\n');
    expect(text).toContain(`LIBRARY (song titles): ${library.slice(0, LIBRARY_MAX).join('; ')}`);
    expect(text).not.toContain('Song 50');
    expect(text).toContain('SONG: none yet');
    expect(text).toContain('SIDEBAR (the new-song fields as they are now');
    expect(text).toContain('title: Luz sobre el mar');
    expect(text).toContain('[Chorus] Mar, llévame despacio / donde duerme el sol');
  });

  it('an empty sidebar says so', () => {
    expect(songStateLines({ library: [], draft: {}, song: null }).join('\n')).toContain('SIDEBAR: empty');
  });

  it('a song thread: title, versions with labels and the active one, header, sections, blocks, style and the bar map', () => {
    const text = songStateLines({ library: [], draft: {}, song }).join('\n');
    expect(text).toContain('SONG: "Night Drive" · active v2 of 2');
    expect(text).toContain('VERSIONS: v1 first generation · v2 score edit (active)');
    expect(text).toContain(`HEADER: M:${facts.header.meter}`);
    expect(text).toContain('STYLE: synthwave, male voice');
    expect(text).toContain(`SECTIONS:\nS1 ${facts.sections[0].label}`);
    expect(text).toContain(facts.bar_map[0]);
  });

  it('a song whose score cannot be read says why and sends no facts', () => {
    const text = songStateLines({ library: [], draft: {}, song: { ...song, facts: null, reason: 'yue-server did not answer' } }).join('\n');
    expect(text).toContain('SCORE: cannot be read (yue-server did not answer)');
    expect(text).not.toContain('BAR MAP');
  });

  it('the 206-bar song stays under 6k tokens at 3 characters a token (F-042 #2)', () => {
    const text = songStateLines({ library: Array.from({ length: 50 }, (_, i) => `A library song title ${i}`), draft: {}, song: { ...song, facts: facts206() } }).join('\n');
    expect(text.length / 3).toBeLessThan(6000);
  });

  it('fieldLines leaves out what is not filled', () => {
    expect(fieldLines({ title: 'X', bpm: 90 })).toEqual(['title: X', 'bpm 90']);
  });
});
