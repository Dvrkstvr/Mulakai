import { describe, it, expect, vi } from 'vitest';
import { lyricsProblems, promptOnlyWords } from './lyricsCheck.js';
import { detectLanguage } from './lyricLanguage.js';

const DE = {
  request: 'ein ruhiges Lied über den Herbst', title: 'Herbstlicht', style: 'acoustic folk, warm female vocal',
  bpm: 84, language: 'de', structure: ['Intro', 'Verse', 'Chorus'],
};
const EN = { ...DE, request: 'a song about a long drive home', title: 'Long Way Home', style: 'americana, male vocal', language: 'en' };
const ES = { ...DE, request: 'una canción de verano', title: 'Noche de verano', style: 'latin pop', language: 'es' };

const DE_OK = [
  ['Der Wind trägt Blätter durch die Gassen', 'Das Licht wird golden, still und weich', 'Ich halte fest, was wir nicht lassen', 'Und jeder Tag wird sanft und gleich'],
  ['Herbstlicht, bleib noch ein wenig hier', 'Herbstlicht, du leuchtest nur für mich', 'Die Tage werden kurz und leise', 'Wir gehen weiter, Schritt für Schritt'],
];
const EN_OK = [
  ['We drove through towns, we met new friends', 'Laughter echoed, we sang along', 'The stars above, they watched us go', 'A memory we will never let go'],
  ['It is a long way home tonight', 'Every mile tells a story of you', 'Sing me the song we used to know', 'Only the road can carry us through'],
];
const reply = (sections: string[][]) => ({ sections: sections.map((lines) => ({ lines })) });
const fixed = (lang: string | null) => vi.fn(async () => lang);

describe('lyricsProblems: passes', () => {
  it('a normal German lyric (real language-ID)', async () => {
    expect(await lyricsProblems(reply(DE_OK), DE, detectLanguage)).toEqual([]);
  });

  it('a normal English lyric with everyday words the rules also use (real language-ID)', async () => {
    expect(await lyricsProblems(reply(EN_OK), EN, detectLanguage)).toEqual([]);
  });
});

describe('lyricsProblems: each check broken once', () => {
  it('schema: not an object with sections', async () => {
    expect(await lyricsProblems({ lyrics: [] }, DE, fixed('de'))).toEqual(['answer with {"sections": [{"lines": [...]}, ...]}: one entry per listed section']);
  });

  it('schema: the wrong number of sections', async () => {
    expect(await lyricsProblems(reply([DE_OK[0]]), DE, fixed('de'))).toEqual(['write exactly 2 sections, one per listed section, in order; you wrote 1']);
  });

  it('schema: a section with too few lines, or a line that is not a string', async () => {
    const r = await lyricsProblems(reply([DE_OK[0].slice(0, 3), [...DE_OK[1].slice(0, 3), 7 as unknown as string]]), DE, fixed('de'));
    expect(r).toEqual(['section 1 has 3 lines: write 4 to 8', 'section 2: every line must be text of 1 to 120 characters']);
  });

  it('a bracket tag in a line', async () => {
    const bad = [DE_OK[0], ['[Refrain] Herbstlicht, bleib noch', ...DE_OK[1].slice(1)]];
    expect(await lyricsProblems(reply(bad), DE, fixed('de'))).toEqual([
      'line 1 of section 2 has a tag or bracket ("[Refrain] Herbstlicht, bleib noch"): write the sung words only, no tags',
    ]);
  });

  it('a line with an embedded newline (SP-7 gemma3 DE08)', async () => {
    const bad = [DE_OK[0], [DE_OK[1][0], 'Herbstlicht, du\nleuchtest nur für mir', ...DE_OK[1].slice(2)]];
    expect(await lyricsProblems(reply(bad), DE, fixed('de'))).toEqual([
      'line 2 of section 2 has a line break inside it: put each sung line in its own entry',
    ]);
  });

  it('a line under 6 characters', async () => {
    const bad = [[...DE_OK[0].slice(0, 3), 'Oh ja'], DE_OK[1]];
    expect(await lyricsProblems(reply(bad), DE, fixed('de'))).toEqual([
      'line 4 of section 1 ("Oh ja") is under 6 characters: write a whole sung line',
    ]);
  });

  it('the wrong language (>= 40 characters)', async () => {
    expect(await lyricsProblems(reply(EN_OK), DE, fixed('en'))).toEqual([
      "the lyrics read as 'en', not German ('de'): write every line in German",
    ]);
  });

  it('language-ID is skipped under 40 characters, and when undecided', async () => {
    const detect = fixed('en');
    const short = [['Ja ja!', 'Na na!', 'Oh oh!', 'Ja ja!']];
    expect(await lyricsProblems(reply(short), { ...DE, structure: ['Verse'] }, detect)).toEqual([]);
    expect(detect).not.toHaveBeenCalled();
    expect(await lyricsProblems(reply(DE_OK), DE, fixed(null))).toEqual([]);
  });

  it('a prompt-only word: "Mulakai en el control" (SP-7 gemma4 RC09)', async () => {
    const lines = ['La noche brilla en la ciudad', 'Mulakai en el control', 'Bailamos juntos sin parar', 'El verano nos llama hoy'];
    const r = await lyricsProblems(reply([lines, lines]), ES, fixed('es'));
    expect(r[0]).toBe("line 2 of section 1 contains 'Mulakai', a word from your instructions, not from the song: remove it");
    expect(r).toHaveLength(2);
  });

  it('a prompt-only word is matched as a whole word, case-insensitively', async () => {
    const lines = [...DE_OK[0].slice(0, 3), 'Wir singen die BRACKETS laut'];
    const r = await lyricsProblems(reply([lines, DE_OK[1]]), DE, fixed('de'));
    expect(r).toEqual(["line 4 of section 1 contains 'BRACKETS', a word from your instructions, not from the song: remove it"]);
  });
});

describe('promptOnlyWords (D-236)', () => {
  it('is the rules\' own vocabulary, without everyday words', () => {
    expect([...promptOnlyWords(EN)].sort()).toEqual([
      'brackets', 'chorus', 'directions', 'english', 'lyrics', 'mulakai', 'section', 'sections', 'singable', 'translations', 'verses',
    ]);
  });

  it('drops a word the request, title or style uses; Mulakai stays', () => {
    const words = promptOnlyWords({ ...EN, request: 'a chorus with my lyrics', title: 'Mulakai Song' });
    expect(words.has('chorus')).toBe(false);
    expect(words.has('lyrics')).toBe(false);
    expect(words.has('mulakai')).toBe(true);
  });
});
