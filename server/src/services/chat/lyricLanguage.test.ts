import { describe, it, expect } from 'vitest';
import { detectLanguage } from './lyricLanguage.js';

// Sections the model wrote in SP-5 (results/*.jsonl recipes), 4 lines each joined by spaces.
const SECTIONS: Array<[string, string]> = [
  ['de', 'Der Tag ist still, das Licht so schwach, Die Worte fehlen mir, ich kann nicht sprechen. In deinen Augen sehe ich den Schmerz, Der mich verlässt, doch ich muss gehen.'],
  ['es', 'La noche brilla bajo el cielo estrellado El ritmo late en cada paso que damos El verano nos llama con su calor Bailamos bajo la luna, sin parar'],
  ['en', 'We drove through towns, we met new friends Laughter echoed, we sang along The stars above, they watched us go A memory we\'ll never let go'],
  ['fr', 'Sous la pluie douce qui tombe en silence Dans les rues vides où l\'ombre s\'installe Je marche seul, le cœur rempli de tristesse Chaque goutte semble un mot qui me parle'],
];

describe('lyric language-ID (eld, SP-5 candidates)', () => {
  it.each(SECTIONS)('%s', async (lang, text) => {
    expect(await detectLanguage(text)).toBe(lang);
  });

  it('an empty text is undecided', async () => {
    expect(await detectLanguage('')).toBeNull();
  });
});
