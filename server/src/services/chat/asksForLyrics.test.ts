/** LD fix (F-095, D-252): code, not the planner, decides whether a follow-up is about the words. */
import { describe, it, expect } from 'vitest';
import { asksForLyrics } from './asksForLyrics.js';

describe('asksForLyrics (D-252)', () => {
  it('a change that is not about the words: no (the live phrasings, F-095 live run)', () => {
    for (const r of ['mach es etwas schneller', 'etwas schneller bitte, Text unverändert', 'setz das Tempo auf 80 bpm, den Text lässt du unverändert',
      'make it faster', 'más lento', 'in D minor please', 'a warmer texture, more strings', 'make another version, slower',
      'same lyrics but faster', 'keep the lyrics, change the key', "faster, don't change the words", 'más rápido, sin cambiar la letra',
      'schneller, den Text nicht ändern', 'misma letra, más lento']) {
      expect(asksForLyrics(r), r).toBe(false);
    }
  });

  it('a request about the words: yes, in en / de / es, any case', () => {
    for (const r of ['schreib den Refrain neu', 'andere Strophen bitte', 'rewrite the chorus', 'cambia la letra', 'new LYRICS please',
      'the second verse is weak', 'make it rhyme', 'reimt sich nicht', 'neuer Songtext', 'den Text umschreiben', 'den Text neu schreiben',
      'reescribe el estribillo', 'otras estrofas', 'keep the chorus but new verses', 'change the words', 'rewrite it but keep the tempo',
      'mehr Wörter über Liebe', 'kürzere Zeilen']) {
      expect(asksForLyrics(r), r).toBe(true);
    }
  });

  it('whole words only: "versions", "Textur", "linear", "Antwort" and "reimagine" are not about the words', () => {
    expect(asksForLyrics('try two versions with a linear build')).toBe(false);
    expect(asksForLyrics('mehr Textur, das ist meine Antwort')).toBe(false);
    expect(asksForLyrics('reimagine it as a waltz')).toBe(false);
  });
});
