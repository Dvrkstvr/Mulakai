/** The M2 ops' shapes (F-029..F-031): bounds per song from the facts, the limits yue-server's models set. */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contract } from '../../../test-fakes/fakeYue.js';
import { buildOpSchema, checkOps, MAX_OPS } from './opSchema.js';
import type { ScoreFacts } from './planTypes.js';
import { LABEL_MAX, LINE_CHARS, LINES_MAX, SEMITONES_MAX, TAG_MAX, sectionOpProblems, sectionOpSchemas } from './sectionSchema.js';

const YUE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../yue-server');
const source = (file: string) => fs.readFileSync(path.join(YUE, file), 'utf8');
/** CHORDS (intro, verse, chorus, outro) with LYRICS_2C's seven blocks, as yue-server read it. */
const facts = contract('read-sections').response.body.facts as ScoreFacts;
const schemaOf = (f: ScoreFacts, name: string) => (sectionOpSchemas(f) as Array<Record<string, any>>)
  .find((s) => s.properties.op.const === name || s.properties.op.enum?.includes(name));

describe('the mirrored limits match yue-server (score_edit_routes.py, score_section_models.py)', () => {
  it('pins the ops per plan to the apply request model: a longer merged REVISE is refused in code, never a 422 (review M2 nit #4)', () => {
    expect(source('score_edit_routes.py')).toContain(`ops: list[Op] = Field(min_length=1, max_length=${MAX_OPS})`);
  });

  it('pins semitones, label, tag and lines to the Python models', () => {
    expect(source('score_edit_routes.py')).toContain(`semitones: int = Field(ge=-${SEMITONES_MAX}, le=${SEMITONES_MAX})`);
    const models = source('score_section_models.py');
    expect(models.match(/label: str = Field\(min_length=1, max_length=(\d+)\)/g)).toEqual(Array(2).fill(`label: str = Field(min_length=1, max_length=${LABEL_MAX})`));
    expect(models).toContain(`tag: str = Field(max_length=${TAG_MAX})`);
    expect(models).toContain(`lines: list[Annotated[str, Field(max_length=${LINE_CHARS})]] = Field(min_length=1, max_length=${LINES_MAX})`);
  });
});

describe('sectionOpSchemas: bounds per song', () => {
  it('TRANSPOSE is a whole number of semitones in -11..11', () => {
    expect(schemaOf(facts, 'TRANSPOSE')!.properties.semitones).toEqual({ type: 'integer', minimum: -11, maximum: 11 });
  });

  it("REPEAT and CUT address the read's sections 1..N, the label one of the song's", () => {
    const s = schemaOf(facts, 'REPEAT')!;
    expect(s.properties.op).toEqual({ enum: ['REPEAT', 'CUT'] });
    expect(s.required).toEqual(['op', 'section', 'label']);
    expect(s.properties.section).toEqual({ type: 'integer', minimum: 1, maximum: 4 });
    expect(s.properties.label).toEqual({ enum: ['intro', 'verse', 'chorus', 'outro'] });
  });

  it('REWRITE_LYRICS addresses blocks 1..B by tag and occurrence, 1-32 lines of text', () => {
    const s = schemaOf(facts, 'REWRITE_LYRICS')!;
    expect(s.properties.block).toEqual({ type: 'integer', minimum: 1, maximum: 7 });
    expect(s.properties.tag).toEqual({ enum: ['[Intro]', '[Verse 1]', '[Chorus]', '[Verse 2]', '[Bridge]', '[Outro]'] });
    expect(s.properties.occurrence).toEqual({ type: 'integer', minimum: 1, maximum: 2 });
    expect(s.properties.lines).toEqual({ type: 'array', minItems: 1, maxItems: 32, items: { type: 'string', minLength: 1, maxLength: 200 } });
  });

  it('leaves out section ops a song cannot take: no labelled section, no lyric block', () => {
    const bare = { ...facts, sections: [{ index: 1, label: '', from_bar: 1, to_bar: 65 }], lyric_blocks: [] };
    expect(sectionOpSchemas(bare).map((s: any) => s.properties.op)).toEqual([{ const: 'TRANSPOSE' }]);
  });

  it('is part of the strict op schema next to the M0 ops and WRITE_PHRASE', () => {
    const items = (buildOpSchema(facts) as any).properties.ops.items.anyOf as Array<{ properties: { op: unknown } }>;
    expect(items.map((i) => i.properties.op)).toEqual([{ const: 'SET_TEMPO' }, { const: 'REHARMONIZE' }, { const: 'EDIT_STYLE' },
      { const: 'WRITE_PHRASE' }, { const: 'TRANSPOSE' }, { enum: ['REPEAT', 'CUT'] }, { const: 'REWRITE_LYRICS' }]);
  });
});

describe('checkOps on the M2 ops', () => {
  it.each(['apply-repeat-compound', 'apply-transpose-sections', 'apply-cut', 'apply-rewrite-lyrics'])(
    "accepts %s's recorded ops", (name) => {
      const ops = contract(name).request.body.ops;
      expect(checkOps({ ops }, facts)).toEqual({ ok: true, ops });
    });

  it('names every bound a reply breaks, with the song\'s numbers', () => {
    const out = checkOps({ ops: [
      { op: 'TRANSPOSE', semitones: 12 },
      { op: 'REPEAT', section: 9, label: 'bridge' },
      { op: 'REWRITE_LYRICS', block: 8, tag: '[Chorus]', occurrence: 0, lines: ['ok', ''] },
    ] }, facts);
    expect(out).toEqual({ ok: false, reasons: [
      'op 1 (TRANSPOSE): semitones 12 is not a whole number in -11..11',
      'op 2 (REPEAT): section 9 does not exist (sections: 1 intro, 2 verse, 3 chorus, 4 outro)',
      'op 2 (REPEAT): label "bridge" is not a section label of this song (intro, verse, chorus, outro)',
      'op 3 (REWRITE_LYRICS): lyric block 8 does not exist (blocks 1-7)',
      'op 3 (REWRITE_LYRICS): occurrence 0 must be 1 or more',
      'op 3 (REWRITE_LYRICS): line 2 must be 1-200 characters of lyric text',
    ] });
  });

  it('leaves 0 semitones and a wrong label-for-section to yue-server, which refuses with the numbers (D-064 c, D-066 a)', () => {
    expect(sectionOpProblems({ op: 'TRANSPOSE', semitones: 0 }, facts)).toEqual([]);
    expect(sectionOpProblems({ op: 'CUT', section: 2, label: 'chorus' }, facts)).toEqual([]);
    expect(sectionOpProblems({ op: 'REWRITE_LYRICS', block: 1, tag: '[Chorus]', occurrence: 1, lines: Array(33).fill('la') }, facts))
      .toEqual(['lines must list 1-32 lyric lines']);
    expect(sectionOpProblems({ op: 'SET_TEMPO', bpm: 88 }, facts)).toBeNull();
  });
});
