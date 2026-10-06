/**
 * Scripted chat-turn replies for fakeOllama (architecture.md "Seams and fakes (chat)"): one builder
 * per action of the closed set, plus the broken replies a turn must survive (invalid JSON, an action
 * outside the set, a bad recipe). SP-5's recorded replies join as data once SP-5 records its fixture.
 */
import type { ChatScript } from './fakeOllama.js';
import { contract } from './fakeYue.js';
import type { ScoreFacts } from '../src/services/score/planTypes.js';
import type { Recipe } from '../src/services/chat/chatTypes.js';

/** A complete, valid recipe (the scope's example: a slow Spanish ballad about the sea). */
export const RECIPE: Recipe = {
  title: 'Luz sobre el mar',
  style: 'Spanish, slow ballad, nylon guitar, soft female voice',
  bpm: 68,
  key: 'Am',
  time_signature: '4/4',
  language: 'es',
  engine: 'yue2',
  structure: ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Outro'],
  lyrics: [
    { tag: 'Verse', lines: ['La marea vuelve a la orilla', 'con la voz de quien se fue', 'guardo sal en las mejillas', 'y una luz que no se ve'] },
    { tag: 'Chorus', lines: ['Mar, llévame despacio', 'donde duerme el sol', 'mar, abre tu espacio', 'para mi canción'] },
    { tag: 'Verse', lines: ['Las gaviotas cuentan cosas', 'que la noche no dirá', 'en la arena quedan rosas', 'que la espuma borrará'] },
    { tag: 'Chorus', lines: ['Mar, llévame despacio', 'donde duerme el sol', 'mar, abre tu espacio', 'para mi canción'] },
    { tag: 'Outro', lines: ['Luz sobre el mar', 'luz sobre el mar', 'quédate un poco más', 'luz sobre el mar'] },
  ],
};

export const reply = (o: unknown, promptTokens = 2000): ChatScript => ({ content: JSON.stringify(o), promptTokens });

export const recipeReply = (over: Partial<Recipe> = {}, message = 'Assuming 4/4 and A minor, lyrics in Spanish.', assumptions = ['assuming 4/4 and A minor']) =>
  reply({ action: 'recipe', message, assumptions, recipe: { ...RECIPE, ...over } });
export const askReply = (message = 'What kind of song?', choices = ['a ballad', 'a dance track']) => reply({ action: 'ask', message, choices });
export const sayReply = (message = 'It is in A minor at 68 BPM.') => reply({ action: 'say', message });
export const editReply = (ops: unknown[] = [{ op: 'SET_TEMPO', bpm: 88 }], message = 'Faster.') =>
  reply({ action: 'edit', message, assumptions: [], ops });
export const scalpelReply = (kind = 'repaint', target = 'chorus 1') =>
  reply({ action: 'scalpel', message: 'I will repaint it.', kind, target, details: 'new words' });
export const analyzeReply = () => reply({ action: 'analyze', message: 'I will read it first.', reference: 'the attached file', plan: 'a recipe like it' });

/** Broken replies. */
export const notJson = (): ChatScript => ({ content: 'Sure! Here is a song: ...', promptTokens: 2000 });
export const outOfSet = () => reply({ action: 'dance', message: 'no' });
export const badKeyRecipe = () => recipeReply({ key: 'Aminor' });

/** read-ok's 65 bars repeated to the 206-bar library song (F-042 #2's yardstick for prompt size). */
export function facts206(): ScoreFacts {
  const facts = contract('read-ok').response.body.facts as ScoreFacts;
  const lines = facts.bar_map.map((l) => l.replace(/^\d+: /, ''));
  const bar_map = Array.from({ length: 206 }, (_, i) => `${i + 1}: ${lines[i % lines.length]}`);
  return { ...facts, header: { ...facts.header, bars: 206, seconds: 340 }, bar_map };
}
