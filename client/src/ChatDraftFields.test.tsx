/** The sidebar's fields with a reference (F-063, F-064; chat-reference.html 3a, 3b, 3b-options B; D-141): a cover's
 * FROM THE SCORE fields locked, a borrow's neutral REFERENCE tag until the person edits it, a missing key as AUTO. */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatDraft, ChatDraftFields } from './api/chat';
import { useChatDraftStore } from './chatDraftStore';
import { ChatDraftFields as Fields } from './ChatDraftFields';

vi.mock('zustand', () => import('./zustandServerSnapshot'));

const FULL: ChatDraftFields = {
  title: 'Die Tür steht offen', style: 'slow pop ballad', bpm: 92, key: 'Am', timeSignature: '4/4', language: 'de',
  structure: ['Verse', 'Chorus'], lyrics: [{ tag: 'Verse', lines: ['Die Tür steht offen'] }], engine: 'yue2',
};
const BORROWED = ['bpm', 'key', 'timeSignature', 'structure'] as const;
function setup(draft: Partial<ChatDraft>, pending: Partial<ChatDraftFields> = {}) {
  const d: ChatDraft = { draft_v: 1, rev: 4, fields: FULL, touched: {}, ...draft };
  useChatDraftStore.setState({ threadId: 't1', draft: d, pending, blockers: [], filled: {}, assistantRev: {}, draftNote: null, error: null });
  return renderToStaticMarkup(<Fields filling={[]} locked={false} />);
}

afterEach(() => useChatDraftStore.getState().clear());

describe('ChatDraftFields with a reference', () => {
  it('a cover: tempo, key, meter and structure FROM THE SCORE and locked with the reason; title and words stay editable', () => {
    const out = setup({ reference: { referenceId: 'r1', use: 'cover' }, borrowed: [...BORROWED] });
    expect(out).toMatch(/TEMPO · KEY<\/div><div class="chat-fv">.*<em class="chat-tag ref score">FROM THE SCORE<\/em>/);
    expect(out).toMatch(/aria-label="Tempo \(BPM\)"[^>]*disabled=""/);
    expect(out).toMatch(/aria-label="Key" disabled=""/);
    expect(out).toMatch(/aria-label="Meter" disabled=""/);
    expect(out).toMatch(/aria-label="Structure"[^>]*disabled=""/);
    expect(out).toContain('a cover sings the score as it is: tempo, key, meter and structure stay');
    expect(out).not.toMatch(/aria-label="Title" disabled=""/);
  });
  it('a borrow: a neutral REFERENCE tag, fields editable', () => {
    const out = setup({ reference: { referenceId: 'r1', use: 'borrow' }, borrowed: ['bpm', 'timeSignature', 'structure'] });
    expect(out).toMatch(/TEMPO · KEY<\/div><div class="chat-fv">.*<em class="chat-tag ref">REFERENCE<\/em>/);
    expect(out).toMatch(/STRUCTURE<\/div><div class="chat-fv">.*<em class="chat-tag ref">REFERENCE<\/em>/);
    expect(out).not.toMatch(/aria-label="Key" disabled=""/);
    expect(out).not.toContain('FROM THE SCORE');
  });
  it('a hand edit of a borrowed field clears its REFERENCE tag (the field becomes the person\'s)', () => {
    const out = setup({ reference: { referenceId: 'r1', use: 'borrow' }, borrowed: ['structure'] }, { structure: ['Verse'] });
    expect(out).not.toContain('>REFERENCE</em>');
    expect(out).toContain('YOURS');
  });
  it('a missing key: blank, KEY · AUTO, and the rust line saying no key was found (F-064 edge)', () => {
    const out = setup({ fields: { ...FULL, key: null }, reference: { referenceId: 'r1', use: 'borrow' }, borrowed: ['bpm'], missing: ['key'] });
    expect(out).toMatch(/aria-label="Key" placeholder="KEY · AUTO" value=""/);
    expect(out).toContain('no key found in the reference');
  });
  it('a missing key the person has typed since is no longer said missing', () => {
    const out = setup({ fields: { ...FULL, key: null }, reference: { referenceId: 'r1', use: 'borrow' }, missing: ['key'] }, { key: 'C' });
    expect(out).not.toContain('no key found');
  });
  it('locked (a take renders): no reference tags', () => {
    useChatDraftStore.setState({ draft: { draft_v: 1, rev: 1, fields: FULL, touched: {}, reference: { referenceId: 'r1', use: 'borrow' }, borrowed: ['bpm'] } });
    expect(renderToStaticMarkup(<Fields filling={[]} locked />)).not.toContain('REFERENCE');
  });
});
