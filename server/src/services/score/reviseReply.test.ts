import { describe, it, expect } from 'vitest';
import { MAX_OPS } from './opSchema.js';
import { NOTHING_REVISED } from './planRevise.js';
import { buildReviseSchema, readRevise, reviseContract, REVISE_REPLY, REVISE_RETRY } from './reviseReply.js';
import type { Op, ScoreFacts } from './planTypes.js';

const facts: ScoreFacts = {
  header: { meter: '4/4', unit: '1/32', bpm: 87, key: 'Dm', bars: 65, seconds: 179.3, units_per_quarter: 8 },
  key_notes: '', lyric_blocks: [], bar_map: [], sections: [{ index: 1, label: 'intro', from_bar: 1, to_bar: 10 },
    { index: 2, label: 'verse', from_bar: 11, to_bar: 46 }, { index: 3, label: 'chorus', from_bar: 47, to_bar: 62 }],
};
const TEMPO: Op = { op: 'SET_TEMPO', bpm: 88 };
const STYLE: Op = { op: 'EDIT_STYLE', style: 'dark pop, jazz' };
const UP_2: Op = { op: 'TRANSPOSE', semitones: 2 };
const REPEAT_3: Op = { op: 'REPEAT', section: 3, label: 'chorus' };
const PENDING = [TEMPO, STYLE, UP_2, REPEAT_3];
type Obj = { type: string; required: string[]; additionalProperties: boolean; properties: Record<string, Record<string, unknown>> };

describe('buildReviseSchema (D-073)', () => {
  it('asks for {drop, ops}: drop holds unique pending op numbers 1..P, ops the usual op list that may be empty', () => {
    const s = buildReviseSchema(facts, 4) as unknown as Obj;
    expect(s).toMatchObject({ type: 'object', additionalProperties: false, required: ['drop', 'ops'] });
    expect(s.properties.drop).toEqual({ type: 'array', items: { type: 'integer', minimum: 1, maximum: 4 }, uniqueItems: true, maxItems: 4 });
    expect(s.properties.ops).toMatchObject({ type: 'array', minItems: 0, maxItems: MAX_OPS });
    expect(JSON.stringify(s.properties.ops)).toContain('"const":"REHARMONIZE"');
  });
});

describe('readRevise (D-073)', () => {
  it('merges an additive reply into the pending plan, with a legend of where each merged op came from', () => {
    const r = readRevise({ drop: [2], ops: [{ op: 'SET_TEMPO', bpm: 80 }, { op: 'CUT', section: 3, label: 'chorus' }] }, PENDING, facts);
    expect(r).toMatchObject({ ok: true, ops: [{ op: 'SET_TEMPO', bpm: 80 }, UP_2, REPEAT_3, { op: 'CUT', section: 3, label: 'chorus' }] });
    expect(r.ok && r.legend).toBe('Your reply made this plan: op 1 = your op 1 (replaces pending op 1), op 2 = pending op 3, '
      + 'op 3 = pending op 4, op 4 = your op 2 (new); dropped: pending op 2.');
  });

  it('refuses a drop outside 1..P, a repeated or a non-integer one', () => {
    expect(readRevise({ drop: [7, 0], ops: [] }, PENDING, facts)).toEqual({ ok: false,
      reasons: ['drop 7 is not a pending op number (1-4)', 'drop 0 is not a pending op number (1-4)'] });
    expect(readRevise({ drop: [2, 2], ops: [] }, PENDING, facts)).toEqual({ ok: false, reasons: ['drop lists pending op 2 twice'] });
    expect(readRevise({ drop: ['2'], ops: [] }, PENDING, facts)).toEqual({ ok: false, reasons: ['drop 2 is not a pending op number (1-4)'] });
  });

  it('refuses a reply that is not {drop, ops}, and passes the op checks through', () => {
    const shape = ['the reply is not a JSON object {"drop":[...],"ops":[...]}'];
    expect(readRevise({ ops: [TEMPO] }, PENDING, facts)).toEqual({ ok: false, reasons: shape });
    expect(readRevise([TEMPO], PENDING, facts)).toEqual({ ok: false, reasons: shape });
    expect(readRevise({ drop: [], ops: [{ op: 'SET_TEMPO', bpm: 999 }] }, PENDING, facts))
      .toEqual({ ok: false, reasons: ['op 1 (SET_TEMPO): bpm 999 is outside 40-240'] });
  });

  it('refuses an empty reply as a revision that changed nothing, fed back like NO_CHANGE', () => {
    expect(readRevise({ drop: [], ops: [] }, PENDING, facts)).toEqual({ ok: false, reasons: [NOTHING_REVISED] });
    expect(NOTHING_REVISED).toBe('the revision changed nothing: list a pending op in drop, or return an op that changes or adds one');
  });

  it('refuses a merged plan with no ops left or more than the op limit', () => {
    expect(readRevise({ drop: [1, 2, 3, 4], ops: [] }, PENDING, facts))
      .toEqual({ ok: false, reasons: ['the revision drops every op: keep a pending op or return one'] });
    const more: Op[] = [{ op: 'REHARMONIZE', from_bar: 1, to_bar: 1, chords: [{ bar: 1, beat: 1, root: 'C', quality: 'maj' }] },
      { op: 'REHARMONIZE', from_bar: 5, to_bar: 5, chords: [{ bar: 5, beat: 1, root: 'C', quality: 'maj' }] },
      { op: 'REHARMONIZE', from_bar: 9, to_bar: 9, chords: [{ bar: 9, beat: 1, root: 'C', quality: 'maj' }] }];
    expect(readRevise({ drop: [], ops: more }, PENDING, facts))
      .toEqual({ ok: false, reasons: [`the revised plan has 7 ops; at most ${MAX_OPS}: drop pending ops or return fewer`] });
  });
});

describe('reviseContract', () => {
  it('carries the schema, the reply and retry lines, and the marks of the last accepted reply', () => {
    const c = reviseContract({ id: 'p1', ops: PENDING }, facts);
    expect(c.schema).toEqual(buildReviseSchema(facts, 4));
    expect([c.replyLine, c.retry]).toEqual([REVISE_REPLY, REVISE_RETRY]);
    expect(c.since()).toBeNull();
    c.read({ drop: [4], ops: [{ op: 'SET_TEMPO', bpm: 80 }] });
    expect(c.since()).toEqual({ planId: 'p1', marks: [{ mark: 'CHANGED', was: TEMPO }, { mark: 'SAME', was: STYLE }, { mark: 'SAME', was: UP_2 }],
      removed: [REPEAT_3] });
    c.read({ drop: [], ops: [] });
    expect(c.since()).toBeNull();
  });
});
