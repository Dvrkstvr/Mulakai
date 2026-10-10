import { describe, expect, it } from 'vitest';
import { assistMessages, keepSuggestions, syllables, type AssistRequest } from './assistPrompt.js';

const base: AssistRequest = {
  kind: 'layer', songId: 's1', caption: 'EDM, phonk, heavy bass', bpm: 128, key: 'D# minor', layers: ['Base', 'Drums'],
  layer: 'Backing vocals', part: 'VERSE 2 · 1:17–1:48', current: '', ask: '',
};
const WORDS = '[Verse 2]\nThe shadows fade, we rise again\nThrough city lights we chase the sound';

describe('syllables', () => {
  it('counts vowel groups, at least one for a line with letters', () => {
    expect(syllables('The shadows fade, we rise again')).toBe(8);
    expect(syllables('Hmm')).toBe(1);
    expect(syllables('')).toBe(0);
  });
});

describe('assistMessages', () => {
  it('gives the song, the lanes and the part as context the person never typed', () => {
    const user = assistMessages(base)[1].content;
    expect(user).toContain('style: EDM, phonk, heavy bass · 128 BPM · key D# minor');
    expect(user).toContain('lanes: Base, Drums');
    expect(user).toContain('the part: VERSE 2 · 1:17–1:48');
    expect(user).toContain('new Backing vocals layer');
  });

  it('lyrics: each sung line carries its syllable count, the tag line none; the language is kept', () => {
    const user = assistMessages({ ...base, kind: 'lyrics', current: WORDS, language: 'en' })[1].content;
    expect(user).toContain('The shadows fade, we rise again   (8 syllables)');
    expect(user).toContain('[Verse 2]\n');
    expect(user).toContain('language: en; keep it');
  });

  it("a refinement says what the person wants", () => {
    expect(assistMessages({ ...base, ask: 'more emotional' })[1].content).toContain('The person wants: more emotional');
  });
});

describe('keepSuggestions', () => {
  const lyrics = { ...base, kind: 'lyrics' as const, current: WORDS };

  it('keeps distinct, changed suggestions, at most three', () => {
    const raw = { suggestions: [{ text: 'a', why: '1' }, { text: 'a', why: '2' }, { text: 'b', why: '' }, { text: 'c', why: '' }, { text: 'd', why: '' }] };
    expect(keepSuggestions(base, raw).map((s) => s.text)).toEqual(['a', 'b', 'c']);
  });

  it('lyrics: drops a rewrite with another line count or a lost tag', () => {
    const ok = '[Verse 2]\nThe shadows fall, we rise once more\nThrough neon rain we chase the roar';
    const short = '[Verse 2]\nThe shadows fall';
    const untagged = 'The shadows fall, we rise once more\nThrough neon rain we chase the roar';
    const raw = { suggestions: [{ text: short, why: '' }, { text: untagged, why: '' }, { text: ok, why: 'rhymes' }] };
    expect(keepSuggestions(lyrics, raw)).toEqual([{ text: ok, why: 'rhymes' }]);
  });

  it('a prompt comes without a label in front ("tags: …"), so USE puts only the prompt in the field', () => {
    const raw = { suggestions: [{ text: 'tags: deeper bass, darker mood', why: '' }, { text: 'Instruction: half-time drums', why: '' }] };
    expect(keepSuggestions({ ...base, kind: 'repaint' }, raw).map((s) => s.text)).toEqual(['deeper bass, darker mood', 'half-time drums']);
    expect(keepSuggestions(base, { suggestions: [{ text: 'Tags: airy pads', why: '' }] })[0].text).toBe('airy pads');
  });

  it('a lyric line is never stripped', () => {
    const words = { ...base, kind: 'lyrics' as const, current: 'Prompt: we rise' };
    expect(keepSuggestions(words, { suggestions: [{ text: 'Tags: we fall', why: '' }] })[0].text).toBe('Tags: we fall');
  });

  it('a reply that is not the asked shape keeps nothing', () => {
    expect(keepSuggestions(base, null)).toEqual([]);
    expect(keepSuggestions(base, { suggestions: 'x' })).toEqual([]);
  });
});
