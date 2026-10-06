/**
 * The recipe and CREATE SONG rules, in one place (chat-server.md): the model's recipe is held to
 * them before it becomes a card (`recipeProblems`, the reasons a retry sends back), and the draft
 * before CREATE SONG (`createBlockers`, shown by the client as is). Pure.
 *
 * Each limit is the downstream one, not a guess, and recipeRules.test.ts pins it to its source:
 * KEYS = yue-server upstream abc_tools.py KEYS; STYLE_MAX / LYRICS_MAX = yue-server request_model.py;
 * BPM = SET_TEMPO's range (score_edit_routes.py, score/opSchema.ts); section tags = YUE2_CAPABILITIES;
 * meters = Guided Create's TIME SIGNATURE options (client songMeta.ts, yue2.ts METER_TEXT).
 * Guided Create itself has one blocking rule on YuE2, a PROMPT (its style); the lyric shape rules
 * (4-8 lines, sections in structure order) are the recipe's quality bar (SP-5 bar d), not blockers.
 */
import { YUE2_CAPABILITIES } from '../engines/yue2.js';
import { lyricsText } from './draftFields.js';
import type { DraftFields, LyricSection, Recipe } from './chatTypes.js';

export const KEYS = [
  'Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
  'Abm', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm', 'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m',
];
export const SECTION_TAGS: string[] = YUE2_CAPABILITIES.sectionTags ?? [];
/** An Intro is instrumental: its tag comes from `structure`, never with lines. */
export const SUNG_TAGS = SECTION_TAGS.filter((t) => t !== 'Intro');
export const TIME_SIGNATURES = ['2/4', '3/4', '4/4', '6/8'];
/** SP-5's recipe languages (all in Guided Create's VOCAL LANGUAGE list). */
export const LANGUAGES = ['en', 'de', 'es', 'fr', 'it', 'pt'];
/** C0 creates on YuE2 only (scope "Scope — Chat"); ACE-Step first takes are C7. */
export const ENGINES = ['yue2'];
export const BPM = { min: 40, max: 240 };
export const STYLE_MAX = 2000;
export const LYRICS_MAX = 16000;
export const LINES = { min: 4, max: 8 };
/** Bounds the recipe schema gives the model (SP-5 schemas.py), tighter than what CREATE SONG takes. */
export const RECIPE_LIMITS = { title: 60, style: 400, line: 120, structure: { min: 3, max: 14 }, sections: 10 };

const BRACKET = /[[\]]/;
const q = (v: unknown) => JSON.stringify(v);
const blank = (s: unknown) => typeof s !== 'string' || !s.trim();

/** Lyric sections: closed tags and no tag or bracket inside a line. */
function sectionProblems(sections: LyricSection[], tags: string[]): string[] {
  const out: string[] = [];
  sections.forEach((s, i) => {
    if (!tags.includes(s.tag)) out.push(`section ${i + 1} tag ${q(s.tag)} is not one of ${tags.join(', ')}`);
    const bad = s.lines.find((l) => BRACKET.test(l));
    if (bad !== undefined) out.push(`section ${i + 1} has a tag or bracket inside a line: ${q(bad.slice(0, 40))}`);
  });
  return out;
}

/** Every field present against the rules; absent fields are not checked. */
export function fieldProblems(f: DraftFields): string[] {
  const out: string[] = [];
  if (f.bpm !== undefined && !(Number.isInteger(f.bpm) && f.bpm >= BPM.min && f.bpm <= BPM.max)) out.push(`bpm ${f.bpm} is not a whole number from ${BPM.min} to ${BPM.max}`);
  if (f.key !== undefined && !KEYS.includes(f.key)) out.push(`key ${q(f.key)} is not one of the 30 key names (C, Am, F#m ...)`);
  if (f.timeSignature !== undefined && !TIME_SIGNATURES.includes(f.timeSignature)) out.push(`time_signature ${q(f.timeSignature)} is not one of ${TIME_SIGNATURES.join(', ')}`);
  if (f.language !== undefined && !LANGUAGES.includes(f.language)) out.push(`language ${q(f.language)} is not one of ${LANGUAGES.join(', ')}`);
  if (f.engine !== undefined && !ENGINES.includes(f.engine)) out.push(`engine ${q(f.engine)}: this chat creates on YuE2 only`);
  for (const t of f.structure ?? []) if (!SECTION_TAGS.includes(t)) out.push(`structure tag ${q(t)} is not one of ${SECTION_TAGS.join(', ')}`);
  return [...out, ...sectionProblems(f.lyrics ?? [], SECTION_TAGS)];
}

/** The lyric sections are the structure minus instrumental sections, in order (SP-5). */
function followsStructure(structure: string[], sections: LyricSection[]): boolean {
  let i = 0;
  return sections.every((s) => {
    while (i < structure.length && structure[i] !== s.tag) i++;
    return i++ < structure.length;
  });
}

/** Why a model's recipe is not acceptable yet, as the retry tells the model. Empty = ok. */
export function recipeProblems(r: Recipe): string[] {
  const out: string[] = [];
  if (blank(r.title)) out.push('title is missing');
  if (blank(r.style)) out.push('style is missing');
  else if (r.style.length > STYLE_MAX) out.push(`style is ${r.style.length} characters; YuE2 takes ${STYLE_MAX}`);
  out.push(...fieldProblems({ bpm: r.bpm, key: r.key, timeSignature: r.time_signature, language: r.language, structure: r.structure }));
  if (!ENGINES.includes(r.engine)) out.push(`engine ${q(r.engine)}: this chat creates on YuE2 only`);
  const { min, max } = RECIPE_LIMITS.structure;
  if (r.structure.length < min || r.structure.length > max) out.push(`structure has ${r.structure.length} sections; write ${min}-${max}`);
  if (r.lyrics.length === 0) return [...out, 'no lyrics: write the sung sections'];
  out.push(...sectionProblems(r.lyrics, SUNG_TAGS));
  r.lyrics.forEach((s, i) => {
    if (s.lines.length < LINES.min || s.lines.length > LINES.max) out.push(`section ${i + 1} (${s.tag}) has ${s.lines.length} lines; write ${LINES.min}-${LINES.max}`);
  });
  if (!followsStructure(r.structure, r.lyrics)) {
    out.push(`the lyrics sections (${r.lyrics.map((s) => s.tag).join(', ')}) must follow the structure (${r.structure.join(', ')}) in order, skipping only instrumental sections`);
  }
  return out;
}

/** Why CREATE SONG is disabled for this draft, in the person's terms. Empty = it can run.
 * `yueConfigured` is whether YUE_API_URL is set (the caller reads config; this stays pure). */
export function createBlockers(f: DraftFields, env: { yueConfigured: boolean }): string[] {
  if (!env.yueConfigured) return ['YuE2 is not configured: set YUE_API_URL on the server'];
  const out: string[] = [];
  if (blank(f.style)) out.push('STYLE is empty: YuE2 has no default style, describe the sound');
  else if (f.style!.length > STYLE_MAX) out.push(`STYLE is ${f.style!.length} characters; YuE2 takes ${STYLE_MAX}, shorten it`);
  const lyrics = lyricsText(f.structure, f.lyrics);
  if (lyrics.length > LYRICS_MAX) out.push(`LYRICS are ${lyrics.length} characters; YuE2 takes ${LYRICS_MAX}, shorten them`);
  return [...out, ...fieldProblems(f)];
}
