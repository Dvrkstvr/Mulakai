/** The CHAT screen from the stores (F-043..F-045; chat-turn.html frames 1-11): layout, thread, sidebar marks. */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatDraftFields, ChatMessageView, ChatThreadView } from './api/chat';
import { useChatDraftStore } from './chatDraftStore';
import { useChatStore } from './chatStore';
import { INITIAL_TURN } from './chatTurn';
import { ChatDraftFields as Fields } from './ChatDraftFields';
import { ChatSidebar } from './ChatSidebar';
import { ChatView } from './ChatView';

// Server rendering reads a zustand store's *initial* state; these stores render the state each test sets.
vi.mock('zustand', () => import('./zustandServerSnapshot'));

const EMPTY: ChatDraftFields = { title: null, style: null, bpm: null, key: null, timeSignature: null, language: null, structure: [], lyrics: [], engine: 'yue2' };
const FULL: ChatDraftFields = { ...EMPTY, title: 'Luz sobre el mar', style: 'slow ballad', bpm: 68, key: 'Am', timeSignature: '4/4', language: 'es', structure: ['Verse'], lyrics: [{ tag: 'Verse', lines: ['La sal'] }] };
const msg = (over: Partial<ChatMessageView>): ChatMessageView => ({
  id: 'm1', seq: 1, role: 'user', kind: 'text', text: 'a slow Spanish ballad', body: { chat_v: 1, sentRev: 1 }, proposalId: null, jobId: 'j1', versionId: null, state: 'done', createdAt: '', ...over,
});
const RECIPE = msg({
  id: 'm2', seq: 2, role: 'assistant', kind: 'recipe', text: 'Assuming about 3 minutes.', proposalId: 'p1', jobId: null, state: 'pending',
  body: { chat_v: 1, recipe: { ...FULL, engine: 'yue2' }, assumptions: [], changed: ['title', 'bpm'], skipped: ['style'] },
});

function setup(messages: ChatMessageView[], fields: ChatDraftFields, songId: string | null = null) {
  const thread = { id: 't1', songId, draft: { draft_v: 1, rev: 3, fields, touched: {} }, blockers: [], messages } as ChatThreadView;
  useChatStore.setState({ status: { configured: true, assistant: 'ok' }, thread, turn: INITIAL_TURN, commit: null, error: null });
  useChatDraftStore.setState({ threadId: 't1', draft: thread.draft, pending: {}, blockers: [], filled: {}, assistantRev: {}, draftNote: null, error: null });
}
const view = () => renderToStaticMarkup(<ChatView onForm={vi.fn()} onLibrary={vi.fn()} />);

afterEach(() => { useChatStore.setState({ thread: null, status: null, turn: INITIAL_TURN }); useChatDraftStore.getState().clear(); });

describe('ChatView', () => {
  it('a new draft: NEW SONG, FORM ▸, NEW CHAT, the empty thread hint, SEND ↵, the sidebar with every field and ENGINE fixed', () => {
    setup([], EMPTY);
    const out = view();
    for (const s of ['NEW SONG', 'DRAFT · NOT A SONG YET', 'FORM ▸', 'NEW CHAT', 'Describe a song', 'SEND ↵', 'FORM · THE DRAFT', 'HIDE ▸', 'TITLE', 'STYLE', 'TEMPO · KEY', 'LANGUAGE', 'STRUCTURE', 'LYRICS', 'YUE2 · FIXED']) {
      expect(out).toContain(s);
    }
    expect(out).toContain('the assistant fills these from your message · nothing commits here');
  });
  it('a recipe reply: the reply with CHANGED and skipped lines, then the card; the foot points at the card', () => {
    setup([msg({}), RECIPE], FULL);
    const out = view();
    expect(out).toContain('CHANGED · TITLE, TEMPO');
    expect(out).toContain('skipped STYLE, you changed it');
    expect(out).toMatch(/class="acid chat-create"><span>CREATE SONG/);
    expect(out).toContain('edit any · CREATE SONG is on the card ◂');
  });
  it('a thinking turn: the line under its message; empty fields read FILLING…', () => {
    setup([msg({ state: 'thinking' })], { ...EMPTY, title: 'Luz' });
    useChatStore.setState({ turn: { ...INITIAL_TURN, messageId: 'm1', jobId: 'j1', phase: { kind: 'thinking', attempt: 1, note: null } } });
    const out = view();
    expect(out).toContain('THINKING… attempt 1 of 3');
    expect(out.match(/FILLING…/g)?.length).toBe(5); // every row but TITLE (filled) and ENGINE (fixed)
    expect(out).toMatch(/class="chat-send" disabled=""/);
  });
  it('assistant off at open: the rust line with the cause over the thread, SEND off', () => {
    setup([], EMPTY);
    useChatStore.setState({ status: { configured: true, assistant: 'off', cause: 'Ollama did not answer at 127.0.0.1:11434' } });
    const out = view();
    expect(out).toContain('ASSISTANT OFF');
    expect(out).toContain('Ollama did not answer at 127.0.0.1:11434');
    expect(out).toContain('nothing commits here · the form does');
  });
  it('a cancelled turn: one CANCELLED line under the message, no rust line for its failed reply', () => {
    const reply = msg({ id: 'm2', role: 'assistant', kind: 'failed', state: 'cancelled', text: 'cancelled', body: { chat_v: 1, reasons: ['cancelled'], cause: 'cancelled' } });
    setup([msg({ state: 'cancelled' }), reply], EMPTY);
    const out = view();
    expect(out.match(/CANCELLED · no reply/g)?.length).toBe(1);
    expect(out).not.toContain('chat-er');
  });
  it('NEW CHAT refused: the reason over the body, the thread kept', () => {
    setup([msg({})], EMPTY);
    useChatStore.setState({ refusal: 'the assistant or CREATE SONG is still working in this chat: CANCEL it first' });
    const out = view();
    expect(out).toContain('NEW CHAT REFUSED');
    expect(out).toContain('CANCEL it first');
    expect(out).toContain('a slow Spanish ballad');
  });
  it("the song's thread: the card folded, the song card, the sidebar a read-only song panel", () => {
    const song = msg({ id: 'm3', seq: 3, role: 'assistant', kind: 'song', text: 'Saved as v1.', state: null, body: { chat_v: 1, seconds: 192, label: 'first take', number: 1 } });
    setup([msg({}), { ...RECIPE, state: 'done' }, song], FULL, 's1');
    const out = view();
    expect(out).toContain('DONE · v1 SAVED');
    expect(out).toContain('<span>v1</span></span><b class="chat-song-title"> · first take');
    expect(out).toContain('3:12 · YUE2 · IN LIBRARY');
    expect(out).toContain('fields as rendered · read-only');
    expect(out).toContain('VERSIONS');
    expect(out).toMatch(/aria-label="Title" disabled=""/);
  });
});

describe('ChatDraftFields marks', () => {
  beforeEach(() => setup([], FULL));
  it('just filled: sky row, ASSISTANT, the old value struck; touched: YOURS', () => {
    useChatDraftStore.setState({ filled: { bpm: { old: 60 } }, pending: { title: 'Mine' } });
    const out = renderToStaticMarkup(<Fields filling={[]} locked={false} />);
    expect(out).toMatch(/chat-fd assistant"><div class="chat-fk">TEMPO · KEY/);
    expect(out).toContain('<s class="chat-old">60</s>');
    expect(out).toMatch(/chat-fd yours"><div class="chat-fk">TITLE/);
    expect(out).toContain('value="Mine"');
  });
  it('locked while a take renders: no marks, inputs off', () => {
    useChatDraftStore.setState({ filled: { bpm: { old: 60 } } });
    const out = renderToStaticMarkup(<Fields filling={[]} locked />);
    expect(out).not.toContain('ASSISTANT');
    expect(out).toMatch(/aria-label="Style" disabled=""/);
  });
  it('lyrics collapsed: the first header and line and the count', () => {
    const out = renderToStaticMarkup(<Fields filling={[]} locked={false} />);
    expect(out).toContain('[Verse]<br/>La sal…');
    expect(out).toContain('▸ 1 lines · ES');
  });
});

describe('ChatSidebar', () => {
  it('collapsed (remembered): the 38 px rail with the filled count', () => {
    vi.stubGlobal('localStorage', { getItem: () => 'closed', setItem: () => undefined });
    const out = renderToStaticMarkup(<ChatSidebar head="FORM · THE DRAFT" foot="" filled={8}><i /></ChatSidebar>);
    vi.unstubAllGlobals();
    expect(out).toContain('class="chat-rail"');
    expect(out).toContain('8 FIELDS FILLED');
  });
});
