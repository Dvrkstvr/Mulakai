/** The recipe and CREATE SONG rules in one place, pinned to the code that enforces them downstream
 * (yue-server's request model and KEYS, the YuE2 engine module, the SET_TEMPO range). */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { YUE2_CAPABILITIES, buildYue2Request } from '../engines/yue2.js';
import { parseMeter } from '../engines/abcMeta.js';
import {
  BPM, KEYS, LANGUAGES, LINES, LYRICS_MAX, SECTION_TAGS, STYLE_MAX, SUNG_TAGS, TIME_SIGNATURES,
  createBlockers, fieldProblems, lyricsFit, plannedProblems, recipeProblems,
} from './recipeRules.js';
import type { DraftFields, Recipe } from './chatTypes.js';

const YUE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../yue-server');
const source = (file: string) => fs.readFileSync(path.join(YUE, file), 'utf8');
const lines = (n: number, word = 'la') => Array.from({ length: n }, (_, i) => `${word} ${i}`);

const RECIPE: Recipe = {
  title: 'Night Drive', style: 'synthwave, warm analog pads, male vocal', bpm: 96, key: 'F#m', time_signature: '4/4',
  language: 'en', engine: 'yue2', structure: ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Outro'],
  lyrics: [{ tag: 'Verse', lines: lines(4) }, { tag: 'Chorus', lines: lines(4) }, { tag: 'Verse', lines: lines(6) }, { tag: 'Chorus', lines: lines(4) }],
};
const READY: DraftFields = { title: 'T', style: 'lofi piano', engine: 'yue2', lyrics: [{ tag: 'Verse', lines: ['the night is long and slow'] }] };
const ON = { yueConfigured: true };

describe('the rules are the downstream ones, not a copy that can drift', () => {
  it('KEYS are upstream abc_tools.py KEYS, in order (30 names)', () => {
    const block = /KEYS = \{([\s\S]*?)\r?\n\}/.exec(source('upstream/abc_tools.py'))![1];
    expect(KEYS).toEqual([...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
    expect(KEYS).toHaveLength(30);
  });

  it("STYLE_MAX and LYRICS_MAX are request_model.py's limits on POST /v1/jobs", () => {
    const model = source('request_model.py');
    expect(model).toContain(`style: str = Field(min_length=1, max_length=${STYLE_MAX})`);
    expect(model).toContain(`lyrics: str = Field(max_length=${LYRICS_MAX})`);
  });

  it("BPM is SET_TEMPO's range in score_edit_routes.py, so a recipe tempo can later be edited by SCORE", () => {
    expect(source('score_edit_routes.py')).toContain(`bpm: int = Field(ge=${BPM.min}, le=${BPM.max})`);
  });

  it("section tags are YuE2's own (YUE2_CAPABILITIES.sectionTags); an Intro is never sung", () => {
    expect(SECTION_TAGS).toBe(YUE2_CAPABILITIES.sectionTags);
    expect(SUNG_TAGS).toEqual(SECTION_TAGS.filter((t) => t !== 'Intro'));
  });

  it('every meter reaches YuE2 as style text and reads back from the ABC header', () => {
    for (const m of TIME_SIGNATURES) {
      expect(buildYue2Request({ prompt: 'x', lyrics: '[Verse]\na', time_signature: m }, () => 1).style).toContain(`${m} time`);
      expect(parseMeter(m)).not.toBe('');
    }
  });
});

describe('recipeProblems: the reasons a retry sends back', () => {
  it('a valid recipe has none', () => {
    expect(recipeProblems(RECIPE)).toEqual([]);
  });

  it.each([
    ['a bad key', { key: 'H' }, /key "H"/],
    ['a tempo out of range', { bpm: 300 }, /bpm 300/],
    ['a fractional tempo', { bpm: 92.5 }, /bpm 92.5/],
    ['an unknown meter', { time_signature: '5/4' }, /time_signature "5\/4"/],
    ['an unknown language', { language: 'xx' }, /language "xx"/],
    ['another engine', { engine: 'acestep' }, /engine "acestep"/],
    ['a blank title', { title: ' ' }, /title/],
    ['a blank style', { style: '' }, /style/],
    ['an unknown structure tag', { structure: ['Intro', 'Verse', 'Drop'] }, /structure tag "Drop"/],
    ['too short a structure', { structure: ['Verse', 'Chorus'] }, /structure has 2/],
  ] as const)('%s', (_name, patch, reason) => {
    expect(recipeProblems({ ...RECIPE, ...patch } as Recipe).join(' | ')).toMatch(reason);
  });

  it(`each sung section has ${LINES.min}-${LINES.max} lines`, () => {
    const r = { ...RECIPE, lyrics: [{ tag: 'Verse', lines: lines(3) }, { tag: 'Chorus', lines: lines(9) }] };
    expect(recipeProblems(r)).toEqual([
      'section 1 (Verse) has 3 lines; write 4-8',
      'section 2 (Chorus) has 9 lines; write 4-8',
    ]);
  });

  it('no tag or bracket inside a line', () => {
    const r = { ...RECIPE, lyrics: [{ tag: 'Verse', lines: ['[Chorus]', ...lines(3)] }, ...RECIPE.lyrics.slice(1)] };
    expect(recipeProblems(r)).toEqual(['section 1 has a tag or bracket inside a line: "[Chorus]"']);
  });

  it('an Intro section is not sung; no lyrics at all is a problem', () => {
    expect(recipeProblems({ ...RECIPE, lyrics: [{ tag: 'Intro', lines: lines(4) }] }).join(' | ')).toMatch(/section 1 tag "Intro"/);
    expect(recipeProblems({ ...RECIPE, lyrics: [] })).toContain('no lyrics: write the sung sections');
  });

  it('the lyric sections follow the structure in order, skipping only instrumental ones', () => {
    const r = { ...RECIPE, structure: ['Intro', 'Verse', 'Chorus', 'Outro'], lyrics: [RECIPE.lyrics[1], RECIPE.lyrics[0]] };
    expect(recipeProblems(r).join(' | ')).toMatch(/must follow the structure/);
  });

  it('LD: over YuE2\'s LYRICS_MAX is a "shorten" reason (the lyrics call retries on it)', () => {
    const long = RECIPE.lyrics.map((s) => ({ ...s, lines: lines(8, 'x'.repeat(600)) }));
    expect(recipeProblems({ ...RECIPE, lyrics: long }).join(' | ')).toMatch(new RegExp(`YuE2 takes ${LYRICS_MAX}: shorten them`));
  });

  it('LD: the planner\'s recipe is checked without lines; lyricsFit = one section per sung section, in order (keep)', () => {
    const { lyrics: _, ...planned } = RECIPE;
    expect(plannedProblems(planned)).toEqual([]);
    expect(plannedProblems({ ...planned, key: 'Aminor' })).toEqual(['key "Aminor" is not one of the 30 key names (C, Am, F#m ...)']);
    const sung = [...RECIPE.lyrics, { tag: 'Outro', lines: lines(4) }];
    expect(lyricsFit(RECIPE.structure, sung)).toBe(true);
    expect(lyricsFit(RECIPE.structure, RECIPE.lyrics)).toBe(false); // the Outro has no lines: write
    expect(lyricsFit([...RECIPE.structure, 'Bridge'], sung)).toBe(false); // a new section: write
    expect(lyricsFit(RECIPE.structure, [sung[1], sung[0], ...sung.slice(2)])).toBe(false);
    expect(lyricsFit(RECIPE.structure, undefined)).toBe(false);
  });
});

describe('F-095 live: a structure that loops a section is refused with the reason (D-255)', () => {
  const { lyrics: _, ...planned } = RECIPE;
  const DRAFT = ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Chorus', 'Outro'];

  it('the live loop (qwen3:14b, "mach es etwas schneller": the draft plus 6 more Outros) is refused, once, with the fix', () => {
    const looped = [...DRAFT, ...Array(6).fill('Outro')];
    expect(plannedProblems({ ...planned, structure: looped })).toEqual(['the structure repeats Outro 7 times at the end: an Outro appears once, last']);
  });

  it('a second Intro or Outro anywhere, or a section 3 times in a row, is refused', () => {
    expect(plannedProblems({ ...planned, structure: ['Intro', 'Verse', 'Intro', 'Chorus', 'Outro'] })).toEqual(['the structure has 2 Intros: an Intro appears once, first']);
    expect(plannedProblems({ ...planned, structure: ['Intro', 'Verse', 'Outro', 'Chorus', 'Outro'] })).toEqual(['the structure has 2 Outros: an Outro appears once, last']);
    expect(plannedProblems({ ...planned, structure: ['Intro', 'Verse', 'Chorus', 'Chorus', 'Chorus', 'Outro'] }))
      .toEqual(['the structure repeats Chorus 3 times in a row: write a section at most twice in a row']);
  });

  it('what SP-5 and the fixtures write passes: the live draft, two Choruses in a row at the end, no Intro or Outro', () => {
    for (const structure of [DRAFT, ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Chorus', 'Chorus', 'Outro'], ['Verse', 'Chorus', 'Verse', 'Chorus', 'Chorus'], ['Verse', 'Verse', 'Chorus', 'Pre-Chorus', 'Chorus']]) {
      expect(plannedProblems({ ...planned, structure }), structure.join(',')).toEqual([]);
    }
  });

  it('CREATE SONG does not block on it: a person may hand-edit any structure', () => {
    expect(createBlockers({ ...READY, structure: ['Outro', 'Outro', 'Outro'] }, ON)).toEqual([]);
  });
});

describe('createBlockers: why CREATE SONG is disabled (F-044 edge)', () => {
  it('a draft with a style on a configured YuE2 can be created', () => {
    expect(createBlockers(READY, ON)).toEqual([]);
  });

  it('YUE_API_URL unset blocks with the reason', () => {
    expect(createBlockers(READY, { yueConfigured: false })).toEqual(['YuE2 is not configured: set YUE_API_URL on the server']);
  });

  it("no style blocks, as Guided Create's GENERATE needs a PROMPT (YuE2 has no default style)", () => {
    expect(createBlockers({ ...READY, style: '  ' }, ON)).toEqual(['STYLE is empty: YuE2 has no default style, describe the sound']);
  });

  it('a style or lyrics over YuE2\'s request limits blocks', () => {
    expect(createBlockers({ ...READY, style: 'x'.repeat(STYLE_MAX + 1) }, ON)[0]).toMatch(/STYLE is 2001 characters/);
    const long = [{ tag: 'Verse', lines: [`${'x'.repeat(LYRICS_MAX)}`] }];
    expect(createBlockers({ ...READY, lyrics: long }, ON)[0]).toMatch(/LYRICS are \d+ characters; YuE2 takes 16000/);
  });

  it('a hand-edited field outside the rules blocks; the 4-8 lines rule does not (Guided Create has none)', () => {
    expect(createBlockers({ ...READY, key: 'Hm', bpm: 20 }, ON)).toEqual([
      'bpm 20 is not a whole number from 40 to 240', 'key "Hm" is not one of the 30 key names (C, Am, F#m ...)',
    ]);
    expect(createBlockers({ ...READY, lyrics: [{ tag: 'Verse', lines: ['one line'] }] }, ON)).toEqual([]);
  });

  it('a tag inside a lyric line blocks: it would open a section YuE2 was not asked for', () => {
    expect(createBlockers({ ...READY, lyrics: [{ tag: 'Verse', lines: ['ok', 'x [Bridge]'] }] }, ON))
      .toEqual(['section 1 has a tag or bracket inside a line: "x [Bridge]"']);
  });

  it('fieldProblems checks only the fields present', () => {
    expect(fieldProblems({})).toEqual([]);
    expect(LANGUAGES).toContain('en');
  });
});
