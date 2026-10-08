import { describe, it, expect } from 'vitest';
import { RECIPE, readingFixture } from '../../../test-fakes/chatScripts.js';
import { emptyDraft, handEdit } from './draftModel.js';
import { REDIRECT, dispatchReply } from './turnDispatch.js';
import { contract } from '../../../test-fakes/fakeYue.js';
import type { AnalyzeBody, EditBase, TurnReply } from './chatTypes.js';
import type { ApplyResult, Op, ScoreFacts } from '../score/planTypes.js';

const recipe: TurnReply = { action: 'recipe', message: 'Here it is.', assumptions: ['assuming A minor'], recipe: RECIPE };
const base = { hasSong: false, draft: emptyDraft(), sentRev: 0, scoreReason: null };

describe('turn dispatch (a checked reply -> what the turn writes)', () => {
  it('say and ask are messages; ask keeps its choices', () => {
    expect(dispatchReply({ ...base, reply: { action: 'say', message: 'hi' } })).toEqual({ kind: 'say', text: 'hi', body: null });
    expect(dispatchReply({ ...base, reply: { action: 'ask', message: 'Which?', choices: ['a', 'b'] } })).toEqual({ kind: 'ask', text: 'Which?', body: { choices: ['a', 'b'] } });
  });

  it('a recipe on the draft thread merges into the draft and becomes a card with changed fields', () => {
    const out = dispatchReply({ ...base, reply: recipe });
    expect(out.kind).toBe('recipe');
    if (out.kind !== 'recipe') return;
    expect(out.draft.fields).toMatchObject({ title: RECIPE.title, key: 'Am', timeSignature: '4/4' });
    expect(out.body).toMatchObject({ recipe: RECIPE, assumptions: ['assuming A minor'], skipped: [] });
    expect(out.body.changed).toContain('title');
  });

  it('a field touched by hand after SEND is skipped and named (CH-6)', () => {
    const typed = handEdit(emptyDraft(), { title: 'Mine' }).draft; // rev 1, after sentRev 0
    const out = dispatchReply({ ...base, draft: typed, reply: recipe });
    if (out.kind !== 'recipe') throw new Error('not a recipe');
    expect(out.draft.fields.title).toBe('Mine');
    expect(out.body.skipped).toEqual(['title']);
  });

  it('scalpel becomes a say naming where it can be done', () => {
    const scalpel = dispatchReply({ ...base, hasSong: true, reply: { action: 'scalpel', message: 'x', kind: 'add_layer', target: 'whole song', details: 'sax' } });
    expect(scalpel).toEqual({ kind: 'say', text: REDIRECT.scalpel('add_layer'), body: null });
    expect(REDIRECT.scalpel('add_layer')).toContain('ADD LAYER');
  });

  it('an edit without a song asks for one; a recipe on a song thread points to NEW CHAT (D-130)', () => {
    const edit: TurnReply = { action: 'edit', message: 'x', assumptions: [], ops: [] };
    expect(dispatchReply({ ...base, reply: edit }).text).toBe(REDIRECT.noSong);
    expect(dispatchReply({ ...base, hasSong: true, reply: recipe })).toEqual({ kind: 'say', text: REDIRECT.recipeOnSong, body: null });
  });

  const facts = contract('read-ok').response.body.facts as ScoreFacts;
  const applied = contract('apply-reharmonize').response.body as ApplyResult;
  const reharm: Op[] = [{ op: 'REHARMONIZE', from_bar: 47, to_bar: 54, chords: [{ bar: 47, beat: 1, root: 'G', quality: 'm7' }] }];
  const editBase: EditBase = {
    songId: 's1', facts, chordsPresent: true,
    source: { abc: 'X:1', style: 'pop', lyrics: null, activeVersionId: 'v1', fingerprint: 'f1' },
  };
  const edit = (ops: Op[]): TurnReply => ({ action: 'edit', message: 'Jazz chords in the chorus.', assumptions: ['assuming chorus 1, bars 47-54'], ops });
  const planned = (ops: Op[], over: Partial<EditBase> = {}) =>
    ({ base: { ...editBase, ...over }, applied, attempts: 2, refusals: [['bar 999 is outside the song']], planId: 'p1', createdAt: 5 });

  it('CB-2: an edit becomes an edit card over a planStore plan: change list, checks, the bars and the splice (F-046 #1, #2)', () => {
    const out = dispatchReply({ ...base, hasSong: true, reply: edit(reharm), edit: planned(reharm) });
    if (out.kind !== 'edit') throw new Error('not an edit card');
    expect(out.text).toBe('Jazz chords in the chorus.');
    expect(out.plan).toMatchObject({ id: 'p1', songId: 's1', baseVersionId: 'v1', fingerprint: 'f1', ops: reharm, abc: applied.abc, attempts: 2, createdAt: 5 });
    expect(out.body).toEqual({
      planId: 'p1', ops: reharm, verdicts: applied.verdicts, checks: out.plan.checks,
      splice: { splice: true, kind: 'reharmonize', from_bar: 47, to_bar: 54 }, renderMode: { cot: 'full', reason: 'chords' },
      assumptions: ['assuming chorus 1, bars 47-54'], attempts: 2, refusals: [['bar 999 is outside the song']],
      from: { bpm: facts.header.bpm, key: facts.header.key },
    });
  });

  it('the card carries the tempo and key the plan was read at, as the SCORE dock shows them (87 → 88, not ? → 88)', () => {
    const tempo: Op[] = [{ op: 'SET_TEMPO', bpm: 88 }];
    const out = dispatchReply({ ...base, hasSong: true, reply: edit(tempo), edit: planned(tempo) });
    if (out.kind !== 'edit') throw new Error('not an edit card');
    expect(typeof facts.header.bpm).toBe('number');
    expect(out.body.from).toEqual({ bpm: facts.header.bpm, key: facts.header.key });
  });

  it('CB-2: any other plan says why the whole song is re-rendered; a chord-free REHARMONIZE takes the whole-song path (F-065 edge)', () => {
    const two: Op[] = [...reharm, { op: 'SET_TEMPO', bpm: 90 }];
    const many = dispatchReply({ ...base, hasSong: true, reply: edit(two), edit: planned(two) });
    expect(many.kind === 'edit' && many.body.splice).toMatchObject({ splice: false });
    const free = dispatchReply({ ...base, hasSong: true, reply: edit(reharm), edit: planned(reharm, { chordsPresent: false }) });
    if (free.kind !== 'edit') throw new Error('not an edit card');
    expect(free.body.splice).toEqual({ splice: false, reason: 'the song has no chords: adding them renders the whole song with chords' });
    expect(free.body.renderMode).toEqual({ cot: 'full', reason: 'reharmonize' });
  });

  it('C1: a marked edit card carries the mark and its notes: a clamp and a whole-song op (D-176, F-055 edge)', () => {
    const two: Op[] = [...reharm, { op: 'SET_TEMPO', bpm: 90 }];
    const mark = { versionId: 'v1', bars: [47, 65] as [number, number], seconds: [100, 179] as [number, number], notes: ['the mark reaches bar 70 but the score ends at bar 65: planned on bars 47-65'] };
    const out = dispatchReply({ ...base, hasSong: true, reply: edit(two), edit: planned(two), mark });
    if (out.kind !== 'edit') throw new Error('not an edit card');
    expect(out.body.mark).toEqual({ ...mark, notes: [mark.notes[0], 'SET TEMPO changes the whole song, not only the marked bars'] });
    const plain = dispatchReply({ ...base, hasSong: true, reply: edit(reharm), edit: planned(reharm) });
    expect(plain.kind === 'edit' && 'mark' in plain.body).toBe(false);
  });

  it('C1 live B3: under a mark the card drops an assumed place that contradicts it; unmarked keeps it', () => {
    const mark = { versionId: 'v1', bars: [30, 36] as [number, number], seconds: [70, 85] as [number, number], notes: [] };
    const reply = { ...edit(reharm), assumptions: ['assuming the first chorus, bars 15-22', 'jazz means seventh chords'] };
    const marked = dispatchReply({ ...base, hasSong: true, reply, edit: planned(reharm), mark });
    expect(marked.kind === 'edit' && marked.body.assumptions).toEqual(['jazz means seventh chords']);
    const plain = dispatchReply({ ...base, hasSong: true, reply, edit: planned(reharm) });
    expect(plain.kind === 'edit' && plain.body.assumptions).toEqual(reply.assumptions);
  });

  it('F-046 edge: a song that is not score-eligible gets the reason as a say, no card', () => {
    const reason = 'This song has a repaint version, so score editing ended when it was made.';
    const out = dispatchReply({ ...base, hasSong: true, reply: edit(reharm), edit: { reason } });
    expect(out).toEqual({ kind: 'say', text: REDIRECT.editRefused(reason), body: null });
    expect(out.text).toContain(reason);
    expect(dispatchReply({ ...base, hasSong: true, scoreReason: 'yue-server did not answer', reply: edit(reharm) }).text).toContain('yue-server did not answer');
  });

  const analyze: TurnReply = { action: 'analyze', message: 'I will read it first.', reference: 'demo.mp3', plan: 'a cover' };
  const card: AnalyzeBody = { target: { referenceId: 'r1' }, name: 'demo.mp3', seconds: 200, readTo: 200, cut: false, estimate: { words: 16, score: 35, caption: 16, total: 67 } };

  it('C3: analyze on the draft thread resolved -> a READ card with its body (F-061)', () => {
    expect(dispatchReply({ ...base, reply: analyze, analyze: { body: card } })).toEqual({ kind: 'analyze', text: 'I will read it first.', body: card });
  });

  it('C3: analyze not resolved -> a say naming what is attached and the ATTACH control', () => {
    const out = dispatchReply({ ...base, reply: analyze, analyze: { reason: 'nothing called "x" is attached or in the library', attached: ['demo.mp3'] } });
    expect(out.kind).toBe('say');
    expect(out.text).toContain('nothing called "x" is attached or in the library');
    expect(out.text).toContain('Attached here: "demo.mp3"');
    expect(out.text).toContain('ATTACH');
    expect(dispatchReply({ ...base, reply: analyze }).text).toContain('ATTACH');
  });

  it('C3: analyze on a song thread points to NEW CHAT (D-130)', () => {
    expect(dispatchReply({ ...base, hasSong: true, reply: analyze, analyze: { body: card } })).toEqual({ kind: 'say', text: REDIRECT.analyzeOnSong, body: null });
  });

  it('C3: a recipe with reference_use on a reading: code fills the borrowed fields and the card names them (D-128; the score first, C3 live D)', () => {
    const reply: TurnReply = { ...recipe, recipe: { ...RECIPE, bpm: 140, key: 'E', reference_use: 'borrow' } };
    const out = dispatchReply({ ...base, reply, reference: { id: 'r1', reading: readingFixture() } });
    if (out.kind !== 'recipe') throw new Error('not a recipe');
    expect(out.draft.fields).toMatchObject({ bpm: 96, key: 'Am' });
    expect(out.body.recipe).toMatchObject({ bpm: 96, key: 'Am', reference_use: 'borrow' });
    expect(out.body.reference).toMatchObject({ referenceId: 'r1', use: 'borrow', borrowed: ['bpm', 'key', 'timeSignature', 'structure'] });
    expect(out.draft.reference).toEqual({ referenceId: 'r1', use: 'borrow' });
  });

  it('C3: reference_use none, or no reading: the recipe as the model wrote it, no reference on the card', () => {
    const none: TurnReply = { ...recipe, recipe: { ...RECIPE, reference_use: 'none' } };
    const out = dispatchReply({ ...base, reply: none, reference: { id: 'r1', reading: readingFixture() } });
    if (out.kind !== 'recipe') throw new Error('not a recipe');
    expect(out.body).not.toHaveProperty('reference');
    expect(out.draft.fields.bpm).toBe(RECIPE.bpm);
  });
});
