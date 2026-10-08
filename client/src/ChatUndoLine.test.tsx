/** UNDO TURN's line (chat-converge.html 5a-5c, F-059): offered, greyed with its reason while a reply is open, the
 * after-line from the body (so a reload shows it), and absent once the song exists or when nothing was filled. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ChatMessageViewC2, ChatRecipeBodyC2, RecipeUndone } from './api/chatConverge';
import { ChatUndoLine } from './ChatUndoLine';

const undo = { rev: 3, before: { style: 'slow ballad' }, fields: ['title' as const, 'style' as const, 'lyrics' as const] };
const recipe = (o: Partial<ChatMessageViewC2> = {}, undone?: RecipeUndone): ChatMessageViewC2 => ({
  id: 'r1', seq: 2, role: 'assistant', kind: 'recipe', text: '', proposalId: 'p1', jobId: null, versionId: null, state: 'pending', createdAt: '',
  body: { chat_v: 1, recipe: {} as never, assumptions: [], changed: undo.fields, skipped: [], undo, ...(undone ? { undone } : {}) } as ChatRecipeBodyC2,
  undo: 'offer', ...o,
});
const CHANGED = 'CHANGED · TITLE, STYLE, LYRICS';
const html = (m: ChatMessageViewC2, o: { songId?: string; turnOpen?: boolean; changed?: string | null } = {}) => renderToStaticMarkup(
  <ChatUndoLine message={m} changed={o.changed === undefined ? CHANGED : o.changed} songId={o.songId ?? null} turnOpen={o.turnOpen ?? false} />,
);

describe('ChatUndoLine', () => {
  it('5a: UNDO TURN is a live link on the CHANGED line', () => {
    const out = html(recipe());
    expect(out).toMatch(/^<div class="chat-hn chat-changed">CHANGED · TITLE, STYLE, LYRICS<button type="button" class="chat-link chat-undo">UNDO TURN<\/button><\/div>$/);
    expect(out).not.toContain('off while');
  });
  it('5c: while a reply is open the link is off, with its reason', () => {
    const out = html(recipe(), { turnOpen: true });
    expect(out).toMatch(/class="chat-link chat-undo" disabled=""/);
    expect(out).toContain('off while a reply is open');
  });
  it('5b: after the undo the line reads UNDONE instead of CHANGED: restored, and kept with the reason, from the body', () => {
    const out = html(recipe({ undo: 'done' }, { at: 1, restored: ['title', 'style'], kept: [{ field: 'lyrics', reason: 'you changed it' }] }));
    expect(out).toContain('UNDONE · restored TITLE, STYLE · kept LYRICS: you changed it');
    expect(out).not.toContain('<button');
    expect(out).not.toContain('CHANGED');
  });
  it('5c: not offered once the song exists (the CHANGED line stays), nor for a turn that filled nothing', () => {
    expect(html(recipe(), { songId: 'song1' })).toBe(`<div class="chat-hn chat-changed">${CHANGED}</div>`);
    expect(html(recipe({ body: { chat_v: 1, recipe: {} as never, assumptions: [], changed: [], skipped: [] } }), { changed: null })).toBe('');
  });
});
