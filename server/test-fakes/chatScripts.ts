/**
 * Scripted chat-turn replies for fakeOllama (architecture.md "Seams and fakes (chat)"): one builder
 * per action of the closed set, plus the broken replies a turn must survive (invalid JSON, an action
 * outside the set, a bad recipe). SP-5's recorded qwen3 replies are data in data/sp5-replies.json.
 */
import type { ChatScript } from './fakeOllama.js';
import { contract } from './fakeYue.js';
import type { ScoreFacts } from '../src/services/score/planTypes.js';
import type { Recipe, ReferenceUse } from '../src/services/chat/chatTypes.js';
import type { Reading } from '../src/services/chat/reading.js';
import type { VersionAnalysis } from '../src/services/chat/analysisTypes.js';

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
export const analyzeReply = (reference = 'the attached file') =>
  reply({ action: 'analyze', message: 'I will read it first.', reference, plan: 'a recipe like it' });
/** C3 (D-128): a recipe on a read reference. The model's tempo / key are deliberately off: code replaces them. */
export const referenceReply = (use: ReferenceUse, over: Partial<Recipe> = {}) =>
  recipeReply({ bpm: 140, key: 'E', reference_use: use, ...over }, use === 'cover' ? 'The same song, sung in Spanish.' : 'A new song in its style.');
export const coverReply = (over: Partial<Recipe> = {}) => referenceReply('cover', over);
export const borrowReply = (over: Partial<Recipe> = {}) => referenceReply('borrow', over);

/** Broken replies. */
export const notJson = (): ChatScript => ({ content: 'Sure! Here is a song: ...', promptTokens: 2000 });
export const outOfSet = () => reply({ action: 'dance', message: 'no' });
export const badKeyRecipe = () => recipeReply({ key: 'Aminor' });

/** C1: a version's analysis of read-ok's score (65 bars, YuE2's own sidecar), each bar 2.75 s, for marked turns. */
export function markAnalysis(versionId: string): VersionAnalysis {
  const facts = contract('read-ok').response.body.facts as ScoreFacts;
  return {
    analysis_v: 1, versionId, readAt: '2026-10-07T10:00:00.000Z', plan: { words: 'skip', score: 'own', sections: 'cached' },
    words: { notRead: 'LYRICS_API_URL is not set' },
    score: { abc: 'X:1', source: 'own', chords: true, facts, warnings: [], measure: null },
    bars: { source: 'cached', offset: 0, starts: Array.from({ length: 65 }, (_, i) => i * 2.75), end: 179.3, agreement: 1 },
  };
}

/** C1: a marked edit reply: one REHARMONIZE over `[from, to]` (the MARK block makes the prompt longer: 6k tokens). */
export const markedEditReply = (from: number, to: number, message = 'Jazzier.') => reply({ action: 'edit', message, assumptions: [],
  ops: [{ op: 'REHARMONIZE', from_bar: from, to_bar: to, chords: [{ bar: from, beat: 1, root: 'G', quality: 'm7' }] }] }, 6000);

/** read-ok's 65 bars repeated to the 206-bar library song (F-042 #2's yardstick for prompt size). */
export function facts206(): ScoreFacts {
  const facts = contract('read-ok').response.body.facts as ScoreFacts;
  const lines = facts.bar_map.map((l) => l.replace(/^\d+: /, ''));
  const bar_map = Array.from({ length: 206 }, (_, i) => `${i + 1}: ${lines[i % lines.length]}`);
  return { ...facts, header: { ...facts.header, bars: 206, seconds: 340 }, bar_map };
}

/** A complete reading (`reading_v: 1`) of a 3:20 German song: words, a coverable score with sections, a caption. */
export function readingFixture(over: Partial<Reading> = {}): Reading {
  const facts: ScoreFacts = {
    header: { meter: '4/4', unit: '1/8', bpm: 96, key: 'Am', bars: 40, seconds: 100, units_per_quarter: 2 },
    key_notes: 'A B C D E F G',
    sections: [
      { index: 1, label: 'intro', from_bar: 1, to_bar: 4 }, { index: 2, label: 'verse', from_bar: 5, to_bar: 16 },
      { index: 3, label: 'chorus', from_bar: 17, to_bar: 24 }, { index: 4, label: 'verse 2', from_bar: 25, to_bar: 32 },
      { index: 5, label: 'chorus', from_bar: 33, to_bar: 40 },
    ],
    lyric_blocks: [], bar_map: [],
  };
  return {
    reading_v: 1, readAt: '2026-10-07T10:00:00Z', seconds: 200, readTo: 200, cut: false,
    plan: { words: 'service', score: 'service', caption: 'service' },
    words: { language: 'de', lines: ['Hey du, was ist los', 'die Nacht ist lang'], instrumental: false },
    score: { abc: 'X:1\nM:4/4\nL:1/8\nQ:1/4=96\nK:Am\n', source: 'transcribed', chords: true, facts, warnings: [],
      measure: { budget: 4096, header: 73, sections: [{ name: 'verse', tokens: 400 }, { name: 'chorus', tokens: 300 }] } },
    caption: { caption: 'dark synthpop, analog bass, male voice', bpm: 120, key: 'D minor', meter: '4/4' },
    ...over,
  };
}

/** C2 (F-058): a revise turn's edit, `{drop, ops}` on the pending plan's op numbers (1-based). The PENDING PLAN block
 * makes read-ok's prompt about 13k characters, so the fake reports 4.5k prompt tokens (the context guard's floor is 1 per 6). */
export const reviseEdit = (drop: number[], ops: unknown[], message = 'Revised.') => reply({ action: 'edit', message, assumptions: [], drop, ops }, 4500);
/** apply-compound's ops: SET_TEMPO 88 (plan 1, `apply-set-tempo`), REHARMONIZE 47-50 and EDIT_STYLE (the additive revise, D-224). */
export const COMPOUND_OPS = contract('apply-compound').request.body.ops as unknown[];
export const REVISE = {
  /** "and jazz chords in bars 47-50, as a jazz trio" on plan 1 = SET_TEMPO 88: merges to apply-compound's ops in order. */
  additive: () => reviseEdit([], COMPOUND_OPS.slice(1), 'And jazz chords in bars 47-50, as a jazz trio.'),
  /** "fewer chords": drops these pending ops. */
  drop: (...n: number[]) => reviseEdit(n, [], 'Fewer chords: dropped the new chords.'),
  /** "forget that, transpose it down a tone": every pending op dropped, one new. */
  replace: (pending: number) => reviseEdit(Array.from({ length: pending }, (_, i) => i + 1), [{ op: 'TRANSPOSE', semitones: -2 }], 'Down a tone instead.'),
  /** Six new ops on a pending plan: the merge is over MAX_OPS (6), a named refusal. */
  overSix: () => reviseEdit([], [{ op: 'TRANSPOSE', semitones: -2 }, { op: 'EDIT_STYLE', style: 'jazz' }, COMPOUND_OPS[1],
    { op: 'REPEAT', section: 3, label: 'chorus' }, { op: 'CUT', section: 4, label: 'outro' }, { op: 'REPEAT', section: 2, label: 'verse' }]),
};
