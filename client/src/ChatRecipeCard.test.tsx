/** The recipe card, one state each (chat-turn.html frames 7-11, fragments d, e; TU-6, TU-7, F-044). */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ChatDraftFields, ChatMessageView, ChatRecipeBody } from './api/chat';
import { ChatRecipeCard } from './ChatRecipeCard';
import type { CardView } from './chatScreen';

const RECIPE: ChatDraftFields = {
  title: 'Luz sobre el mar', style: 'slow Spanish ballad, nylon guitar', bpm: 68, key: 'Am', timeSignature: '4/4', language: 'es',
  structure: ['Intro', 'Verse', 'Chorus'], lyrics: [{ tag: 'Verse', lines: ['La sal en tu piel', 'el viento'] }], engine: 'yue2',
};
const body: ChatRecipeBody = { chat_v: 1, recipe: RECIPE, assumptions: [], changed: ['title'], skipped: [], estSeconds: 190 };
const M: ChatMessageView = {
  id: 'r1', seq: 2, role: 'assistant', kind: 'recipe', text: 'Assuming…', body, proposalId: 'p1', jobId: null, versionId: null, state: 'pending', createdAt: '',
};
const html = (view: CardView, o: { live?: ChatDraftFields; blockers?: string[]; ahead?: number } = {}) => renderToStaticMarkup(
  <ChatRecipeCard
    message={M} view={view} live={o.live ?? RECIPE} blockers={o.blockers ?? []} ahead={o.ahead ?? 0} doneNumber={1} canAsk
    onCreate={vi.fn()} onAskAgain={vi.fn()} onCancelQueued={vi.fn()}
  />,
);
const PENDING: CardView = { kind: 'pending', error: null };

describe('ChatRecipeCard', () => {
  it('pending: the summary, the consequence line, CREATE SONG live (acid)', () => {
    const out = html(PENDING);
    expect(out).toContain('PROPOSAL · NEW SONG');
    expect(out).toContain('Luz sobre el mar');
    expect(out).toContain('68 BPM · A MINOR · 4/4 · 3 SECTIONS · 2 LINES · YUE2');
    expect(out).toContain('INTRO · VERSE · CHORUS');
    expect(out).toContain('Renders a new song on YuE2, about 3 min · uses the GPU · lands in Library · nothing else changes');
    expect(out).toMatch(/<button type="button" class="acid chat-create"><span>CREATE SONG/);
  });
  it('a busy GPU queues, never disables (fragment e)', () => {
    const out = html(PENDING, { ahead: 1 });
    expect(out).toContain('starts after 1 job');
    expect(out).not.toMatch(/chat-create" disabled/);
  });
  it('a server blocker: CREATE SONG off with the reason', () => {
    const out = html(PENDING, { blockers: ['STYLE is empty'] });
    expect(out).toContain('CREATE SONG is off: STYLE is empty');
    expect(out).toMatch(/class="acid chat-create" disabled=""/);
  });
  it('a hand edit: the card mirrors the live draft, the old tempo struck, YOUR EDIT (TU-7)', () => {
    const out = html(PENDING, { live: { ...RECIPE, bpm: 72 } });
    expect(out).toContain('<s>68</s> 72 BPM');
    expect(out).toContain('YOUR EDIT');
  });
  it('superseded: dimmed, the proposal as it was, no button', () => {
    const out = html({ kind: 'superseded' }, { live: { ...RECIPE, bpm: 60 } });
    expect(out).toContain('chat-card sup');
    expect(out).toContain('SUPERSEDED');
    expect(out).toContain('68 BPM');
    expect(out).not.toContain('CREATE SONG');
  });
  it('expired: rust, fields kept, ASK AGAIN', () => {
    const out = html({ kind: 'expired' });
    expect(out).toContain('THIS PROPOSAL EXPIRED');
    expect(out).toContain('ASK AGAIN');
    expect(out).not.toContain('CREATE SONG');
  });
  it('committing: the label stays, the button is off, the take runs on the shader line below', () => {
    const out = html({ kind: 'committing', phase: { kind: 'running', progressText: 'synthesizing audio 41%' } });
    expect(out).toMatch(/class="acid chat-create" disabled=""><span>CREATE SONG/);
    expect(out).toContain('RENDERING ON YUE2 · synthesizing audio 41%');
    expect(out).toContain('chat-job working');
  });
  it('committing, queued: a dashed line with CANCEL', () => {
    const out = html({ kind: 'committing', phase: { kind: 'queued', ahead: 2 } });
    expect(out).toContain('chat-job waiting');
    expect(out).toContain('STARTS AFTER 2 JOBS');
    expect(out).toContain('CANCEL');
  });
  it('a failed take: back to pending with the rust error and RETRY', () => {
    const out = html({ kind: 'pending', error: 'YuE2 ran out of memory' });
    expect(out).toContain('CREATE FAILED');
    expect(out).toContain('YuE2 ran out of memory · the draft and the thread are kept');
    expect(out).toContain('RETRY');
  });
  it('done: folds to one line', () => {
    const out = html({ kind: 'done' });
    expect(out).toContain('PROPOSAL · NEW SONG · LUZ SOBRE EL MAR');
    expect(out).toContain('DONE · v1 SAVED');
    expect(out).not.toContain('CREATE SONG');
  });
});
