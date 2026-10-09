/** F-097 (D-260): an instrumental new song in chat. The card says INSTRUMENTAL where the LYRICS toggle goes; the sidebar's
 * LYRICS row reads "instrumental · no vocals" and stays editable (typed lyrics make the draft sung, on the server). */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatDraft, ChatDraftFields, ChatMessageView, ChatRecipeBody } from './api/chat';
import { ChatRecipeCard } from './ChatRecipeCard';
import { ChatDraftFields as Fields } from './ChatDraftFields';
import { filledCount, useChatDraftStore } from './chatDraftStore';

vi.mock('zustand', () => import('./zustandServerSnapshot'));

const INSTRUMENTAL: ChatDraftFields = {
  title: 'Nachtfahrt', style: 'lo-fi, Rhodes, soft drums', bpm: 84, key: 'Am', timeSignature: '4/4', language: 'de',
  structure: ['Intro', 'Verse', 'Chorus', 'Outro'], lyrics: [], engine: 'yue2', vocals: 'instrumental',
};
const SUNG: ChatDraftFields = { ...INSTRUMENTAL, vocals: 'sung', lyrics: [{ tag: 'Verse', lines: ['Die Stadt schläft ein'] }] };

const card = (f: ChatDraftFields) => {
  const body: ChatRecipeBody = { chat_v: 1, recipe: f, assumptions: [], changed: [], skipped: [], estSeconds: 90 };
  const m: ChatMessageView = { id: 'r1', seq: 2, role: 'assistant', kind: 'recipe', text: '', body, proposalId: 'p1', jobId: null, versionId: null, state: 'pending', createdAt: '' };
  return renderToStaticMarkup(
    <ChatRecipeCard message={m} view={{ kind: 'pending', error: null }} live={f} blockers={[]} ahead={0} doneNumber={null} canAsk
      onCreate={vi.fn()} onAskAgain={vi.fn()} onCancelQueued={vi.fn()} />,
  );
};
const sidebar = (fields: ChatDraftFields) => {
  const d: ChatDraft = { draft_v: 1, rev: 2, fields, touched: {} };
  useChatDraftStore.setState({ threadId: 't1', draft: d, pending: {}, blockers: [], filled: {}, assistantRev: {}, draftNote: null, error: null });
  return renderToStaticMarkup(<Fields filling={[]} locked={false} />);
};

afterEach(() => useChatDraftStore.getState().clear());

describe('an instrumental draft (F-097)', () => {
  it('the card: INSTRUMENTAL · no vocals where the LYRICS toggle goes, CREATE SONG live', () => {
    const out = card(INSTRUMENTAL);
    expect(out).toContain('INSTRUMENTAL · no vocals');
    expect(out).not.toContain('>LYRICS ');
    expect(out).toMatch(/<button type="button" class="acid chat-create"><span>CREATE SONG/);
    expect(card(SUNG)).not.toContain('INSTRUMENTAL');
  });

  it('the sidebar: LYRICS reads instrumental · no vocals and the field stays editable', () => {
    const out = sidebar(INSTRUMENTAL);
    expect(out).toMatch(/LYRICS<\/div><div class="chat-fv">.*instrumental · no vocals/);
    expect(out).toContain('type lyrics to make it sung');
    expect(out).toMatch(/aria-label="Lyrics" rows="3"/);
    expect(sidebar(SUNG)).not.toContain('instrumental · no vocals');
  });

  it('vocals is no filled field of its own on the rail count', () => {
    const { vocals: _, ...without } = INSTRUMENTAL;
    expect(filledCount(INSTRUMENTAL)).toBe(filledCount(without));
  });
});
