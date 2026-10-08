/** UNDO TURN never touches a hand edit (architecture.md "Test strategy (C2)" #2): the draftUndo table. */
import { describe, it, expect } from 'vitest';
import { RECIPE } from '../../../test-fakes/chatScripts.js';
import { applyRecipe, emptyDraft, handEdit } from './draftModel.js';
import { draftUndo, KEPT_HAND, KEPT_LATER } from './draftUndo.js';
import type { Draft, RecipeBody } from './chatTypes.js';

const open = { hasSong: false, busy: false };

/** A draft with a hand-typed title and style, then a turn's recipe merged over it (as turnDispatch does). */
function filled(start: Draft = handEdit(emptyDraft(), { title: 'Mine', style: 'folk' }).draft) {
  const sentRev = start.rev;
  const merged = applyRecipe(start, RECIPE, sentRev);
  const body: RecipeBody = {
    recipe: RECIPE, assumptions: [], changed: merged.changed, skipped: merged.skipped,
    undo: { rev: merged.draft.rev, before: merged.before, fields: merged.changed },
  };
  return { start, draft: merged.draft, body };
}

describe('draftUndo', () => {
  it('untouched fields are restored to their old value; fields that were empty are cleared', () => {
    const { start, draft, body } = filled();
    const out = draftUndo(draft, body, open);
    if (!out.ok) throw new Error(out.reason);
    expect(out.draft.fields).toEqual(start.fields);
    expect(out.restored).toEqual(body.undo!.fields);
    expect(out.kept).toEqual([]);
    expect(out.draft.rev).toBe(draft.rev + 1);
    expect(out.draft.touched).toEqual(draft.touched); // an undo is not a hand edit
  });

  it('a field typed by hand after the turn is kept and named', () => {
    const { start, draft, body } = filled();
    const edited = handEdit(draft, { lyrics: [{ tag: 'Verse', lines: ['my own line'] }] }).draft;
    const out = draftUndo(edited, body, open);
    if (!out.ok) throw new Error(out.reason);
    expect(out.kept).toEqual([{ field: 'lyrics', reason: KEPT_HAND }]);
    expect(out.restored).not.toContain('lyrics');
    expect(out.draft.fields.lyrics).toEqual([{ tag: 'Verse', lines: ['my own line'] }]);
    expect(out.draft.fields.title).toBe(start.fields.title);
  });

  it('a hand edit back to the turn\'s own value still counts as the person\'s', () => {
    const { draft, body } = filled();
    const touchedAgain = { ...draft, rev: draft.rev + 1, touched: { ...draft.touched, style: draft.rev + 1 } };
    const out = draftUndo(touchedAgain, body, open);
    expect(out.ok && out.kept).toEqual([{ field: 'style', reason: KEPT_HAND }]);
  });

  it('a field a later turn overwrote is kept and named', () => {
    const { draft, body } = filled();
    const later = applyRecipe(draft, { ...RECIPE, bpm: 90 }, draft.rev).draft;
    const out = draftUndo(later, body, open);
    if (!out.ok) throw new Error(out.reason);
    expect(out.kept).toEqual([{ field: 'bpm', reason: KEPT_LATER }]);
    expect(out.draft.fields.bpm).toBe(90);
  });

  it('a restored field loses a reference mark the turn set', () => {
    const { draft, body } = filled();
    const marked: Draft = { ...draft, reference: { referenceId: 'r', use: 'borrow' }, borrowed: ['bpm', 'key'], missing: ['title'] };
    const out = draftUndo(marked, body, open);
    expect(out.ok && [out.draft.borrowed, out.draft.missing]).toEqual([[], []]);
  });

  it('refuses a song thread, an open turn, a turn with no record, and one already undone', () => {
    const { draft, body } = filled();
    expect(draftUndo(draft, body, { ...open, hasSong: true })).toMatchObject({ ok: false, error: 'UNDO_REFUSED' });
    expect(draftUndo(draft, body, { ...open, busy: true })).toMatchObject({ ok: false, error: 'TURN_OPEN' });
    const { undo: _u, ...old } = body;
    expect(draftUndo(draft, old, open)).toMatchObject({ ok: false, error: 'UNDO_REFUSED' });
    expect(draftUndo(draft, { ...body, undo: { rev: 1, before: {}, fields: [] } }, open)).toMatchObject({ ok: false, error: 'UNDO_REFUSED' });
    expect(draftUndo(draft, null, open)).toMatchObject({ ok: false, error: 'UNDO_REFUSED' });
    const undone = { ...body, undone: { at: 1, restored: [], kept: [] } };
    expect(draftUndo(draft, undone, open)).toMatchObject({ ok: false, error: 'UNDO_REFUSED', reason: expect.stringMatching(/already/) });
  });

  it('everything kept: the draft is unchanged (no new rev)', () => {
    const { draft, body } = filled();
    const allMine = { ...draft, rev: draft.rev + 1, touched: Object.fromEntries(body.undo!.fields.map((f) => [f, draft.rev + 1])) };
    const out = draftUndo(allMine, body, open);
    if (!out.ok) throw new Error(out.reason);
    expect(out.restored).toEqual([]);
    expect(out.draft).toBe(allMine);
  });

  it('undoneRecord is what the message body stores', async () => {
    const { draft, body } = filled();
    const out = draftUndo(draft, body, open);
    const { undoneRecord } = await import('./draftUndo.js');
    if (!out.ok) throw new Error(out.reason);
    expect(undoneRecord(out, 1000)).toEqual({ at: 1000, restored: out.restored, kept: [] });
  });
});
