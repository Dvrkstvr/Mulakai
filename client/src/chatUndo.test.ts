/** UNDO TURN and the just-filled marks (F-059, D-220, D-221): which recipe reply offers UNDO TURN, what an undone one
 * says, and the ASSISTANT marks rebuilt from the latest recipe's undo record so they survive a reload. */
import { describe, it, expect } from 'vitest';
import { justFilled, undoLine } from './chatUndo';
import type { ChatDraft } from './api/chat';
import type { ChatMessageViewC2, ChatRecipeBodyC2 } from './api/chatConverge';

const undo = { rev: 4, before: { title: 'Old', bpm: 90 }, fields: ['title' as const, 'bpm' as const, 'style' as const] };
const recipe = (id: string, body: Partial<ChatRecipeBodyC2> = {}, offer: ChatMessageViewC2['undo'] = 'offer'): ChatMessageViewC2 => ({
  id, seq: 0, role: 'assistant', kind: 'recipe', text: '', proposalId: null, jobId: null, versionId: null, state: 'pending', createdAt: '',
  body: { chat_v: 1, recipe: {} as ChatRecipeBodyC2['recipe'], assumptions: [], changed: ['title', 'bpm', 'style'], skipped: [], undo, ...body },
  undo: offer,
});
const user = (id: string): ChatMessageViewC2 => ({
  id, seq: 0, role: 'user', kind: 'text', text: 'hi', body: { chat_v: 1, sentRev: 4 }, proposalId: null, jobId: null, versionId: null, state: null, createdAt: '',
});
const draft = (touched: ChatDraft['touched'] = {}): ChatDraft =>
  ({ draft_v: 1, rev: 4, fields: {} as ChatDraft['fields'], touched });

describe('undoLine', () => {
  it('a recipe the server offers UNDO for: the button, held while a turn runs', () => {
    expect(undoLine(recipe('r1'), null, false)).toEqual({ kind: 'offer', disabled: false });
    expect(undoLine(recipe('r1'), null, true)).toEqual({ kind: 'offer', disabled: true });
  });

  it('an undone one says what it restored and kept', () => {
    const undone = { at: 1, restored: ['title' as const], kept: [{ field: 'bpm' as const, reason: 'you changed it' }] };
    expect(undoLine(recipe('r1', { undone }, 'done'), null, false)).toEqual({ kind: 'done', undone });
    expect(undoLine(recipe('r1', {}, 'done'), null, false)).toEqual({ kind: 'done', undone: null });
  });

  it('not offered once the song exists, for a turn that filled nothing, without a record, or not a recipe', () => {
    expect(undoLine(recipe('r1'), 'song1', false)).toBeNull();
    expect(undoLine(recipe('r1', { undo: { rev: 4, before: {}, fields: [] } }), null, false)).toBeNull();
    expect(undoLine(recipe('r1', { undo: undefined }), null, false)).toBeNull();
    expect(undoLine(recipe('r1', {}, null), null, false)).toBeNull();
    const { undo: _offer, ...older } = recipe('r1'); // an older server sends no offer
    expect(undoLine(older, null, false)).toBeNull();
    expect(undoLine(user('u1'), null, false)).toBeNull();
  });
});

describe('justFilled', () => {
  it('the latest recipe’s fields with their old values; absent before = was empty', () => {
    expect(justFilled([user('u1'), recipe('r1')], draft())).toEqual({ title: { old: 'Old' }, bpm: { old: 90 }, style: { old: null } });
  });

  it('a field touched by hand after the reply reads YOURS, not ASSISTANT', () => {
    expect(justFilled([recipe('r1')], draft({ bpm: 5, title: 4 }))).toEqual({ title: { old: 'Old' }, style: { old: null } });
  });

  it('cleared by the next message, by an undo, or with no record', () => {
    expect(justFilled([recipe('r1'), user('u2')], draft())).toEqual({});
    expect(justFilled([recipe('r1', { undone: { at: 1, restored: [], kept: [] } }, 'done')], draft())).toEqual({});
    expect(justFilled([recipe('r1', { undo: undefined })], draft())).toEqual({});
    expect(justFilled([], draft())).toEqual({});
  });

  it('only the latest recipe counts', () => {
    const older = recipe('r0', { undo: { rev: 2, before: {}, fields: ['key'] } });
    expect(Object.keys(justFilled([older, recipe('r1', { undo: { rev: 4, before: {}, fields: ['language'] } })], draft()))).toEqual(['language']);
  });
});
