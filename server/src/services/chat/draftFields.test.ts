/** The draft -> Guided Create's CreateFields + title, as buildYue2Request takes them for CREATE SONG. */
import { describe, it, expect } from 'vitest';
import { buildYue2Request, INSTRUMENTAL_LYRICS } from '../engines/yue2.js';
import { draftFields, lyricsText } from './draftFields.js';
import type { DraftFields } from './chatTypes.js';

const FIELDS: DraftFields = {
  title: 'Night Drive', style: 'synthwave, warm pads', bpm: 96, key: 'Am', timeSignature: '6/8', language: 'en',
  structure: ['Intro', 'Verse', 'Chorus', 'Outro'], engine: 'yue2',
  lyrics: [{ tag: 'Verse', lines: ['one', 'two'] }, { tag: 'Chorus', lines: ['three', ' ', 'four'] }],
};

describe('lyricsText: sung text in structure order', () => {
  it('instrumental sections are bare tags; sung ones carry their lines; blank lines are dropped', () => {
    expect(lyricsText(FIELDS.structure, FIELDS.lyrics)).toBe('[Intro]\n\n[Verse]\none\ntwo\n\n[Chorus]\nthree\nfour\n\n[Outro]\n');
  });

  it('a repeated tag takes the next section with that tag', () => {
    const text = lyricsText(['Verse', 'Chorus', 'Verse'], [{ tag: 'Verse', lines: ['a'] }, { tag: 'Chorus', lines: ['b'] }, { tag: 'Verse', lines: ['c'] }]);
    expect(text).toBe('[Verse]\na\n\n[Chorus]\nb\n\n[Verse]\nc\n');
  });

  it('sections the structure does not place are kept at the end, never lost', () => {
    expect(lyricsText(['Chorus'], [{ tag: 'Verse', lines: ['a'] }, { tag: 'Chorus', lines: ['b'] }]))
      .toBe('[Chorus]\n\n[Verse]\na\n\n[Chorus]\nb\n');
  });

  it('no structure: the sections in order', () => {
    expect(lyricsText([], [{ tag: 'Verse', lines: ['a'] }])).toBe('[Verse]\na\n');
  });

  it("no sung line at all is '' (YuE2's instrumental, as Guided Create's INSTRUMENTAL on YuE2)", () => {
    expect(lyricsText(['Intro', 'Verse'], [{ tag: 'Verse', lines: [' '] }])).toBe('');
    expect(lyricsText(undefined, undefined)).toBe('');
  });
});

describe('draftFields: what CREATE SONG sends', () => {
  it('maps style -> prompt, Am -> A minor, 6/8 -> its numerator, en -> vocal_language', () => {
    expect(draftFields(FIELDS)).toEqual({
      title: 'Night Drive',
      fields: {
        prompt: 'synthwave, warm pads', lyrics: lyricsText(FIELDS.structure, FIELDS.lyrics),
        bpm: 96, key_scale: 'A minor', time_signature: '6', vocal_language: 'en',
      },
    });
  });

  it('reaches YuE2 as Guided Create would send it: language, style, tempo, key and meter as style text', () => {
    const req = buildYue2Request(draftFields(FIELDS).fields, () => 7);
    expect(req).toEqual({ style: 'English, synthwave, warm pads, 96 bpm, A minor, 6/8 time', lyrics: draftFields(FIELDS).fields.lyrics, seed: 7 });
  });

  it("a language YuE2 does not list is left out, as Guided Create's liveLanguage does (the lyrics carry it)", () => {
    expect(draftFields({ ...FIELDS, language: 'de' }).fields.vocal_language).toBeUndefined();
  });

  it('an empty draft is Untitled with nothing set; no lyrics makes YuE2 an instrumental', () => {
    const { title, fields } = draftFields({ style: 'ambient' });
    expect(title).toBe('Untitled');
    expect(fields).toEqual({ prompt: 'ambient', lyrics: '' });
    expect(buildYue2Request(fields, () => 1).lyrics).toBe(INSTRUMENTAL_LYRICS);
  });

  it('F# major and Bbm keep their accidentals', () => {
    expect(draftFields({ key: 'F#' }).fields.key_scale).toBe('F# major');
    expect(draftFields({ key: 'Bbm' }).fields.key_scale).toBe('Bb minor');
  });
});
