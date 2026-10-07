/** The READ card (F-061; design/chat-reference.html 2a, 2b; D-134 rights, D-137 layers, D-138 cut, D-141 no
 * invented GPU seconds). */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ChatAnalyzeBody, ChatMessageView } from './api/chat';
import type { ReferenceView } from './api/chatReferences';
import { ChatAnalyzeCard } from './ChatAnalyzeCard';
import type { CardPhase } from './chatReading';

const BODY: ChatAnalyzeBody = {
  chat_v: 1, target: { referenceId: 'r1' }, name: 'slow_dance_demo.mp3', seconds: 192, readTo: 192, cut: false,
  estimate: { words: 20, score: 90, caption: 15, total: 125 },
};
const MSG: ChatMessageView = {
  id: 'a1', seq: 2, role: 'assistant', kind: 'analyze', text: 'I can read it first.', body: BODY, proposalId: 'p1', jobId: null,
  versionId: null, state: 'pending', createdAt: '',
};
const REF = { id: 'r1', origin: 'upload', name: 'slow_dance_demo.mp3', layers: null, seconds: 192 } as ReferenceView;

const card = (phase: CardPhase | null, over: { body?: Partial<ChatAnalyzeBody>; reference?: Partial<ReferenceView>; ahead?: number } = {}) =>
  renderToStaticMarkup(
    <ChatAnalyzeCard
      message={{ ...MSG, body: { ...BODY, ...over.body } }} card={phase ? { phase, jobId: null, stage: null } : undefined}
      reference={{ ...REF, ...over.reference }} ahead={over.ahead ?? 0} onRead={vi.fn()}
    />,
  );

describe('ChatAnalyzeCard', () => {
  it('pending: the header, the name and length, the rights line, the consequence, READ as the one acid fill', () => {
    const out = card({ kind: 'pending' });
    for (const s of ['READ · A SONG TO WORK FROM', 'nothing is saved to your library', 'slow_dance_demo.mp3', '3:12 · uploaded',
      'Stays on this machine. You are responsible for the rights to this recording.', 'Reads WORDS &gt; SCORE &gt; CAPTION', 'changes nothing']) {
      expect(out).toContain(s);
    }
    expect(out).toMatch(/<button type="button" class="acid chat-create"><span>READ<\/span>/);
  });
  it('no GPU seconds until CP-C3 calibrates them (D-141); a library song with no GPU says so', () => {
    expect(card({ kind: 'pending' })).not.toMatch(/about \d+ s/);
    expect(card({ kind: 'pending' }, { body: { estimate: { words: 0, score: 0, caption: 0, total: 0 } } })).toContain('uses no GPU');
  });
  it('a busy queue: the consequence says when it starts', () => {
    expect(card({ kind: 'pending' }, { ahead: 2 })).toContain('starts after 2 jobs');
  });
  it('longer than 360 s: reads the first 6:00, A/B plays all of it (D-138)', () => {
    expect(card({ kind: 'pending' }, { body: { seconds: 461, readTo: 360, cut: true } })).toContain('7:41 long · reads the first 6:00 only');
  });
  it('a library song with 3 layers: the base layer only (D-137)', () => {
    const out = card({ kind: 'pending' }, { body: { target: { songId: 's1' }, name: 'Luz sobre el mar' }, reference: { origin: 'library', layers: 3 } });
    expect(out).toContain('library');
    expect(out).toContain('reads the base layer only · its other 2 layers are not read');
  });
  it('starting: READ keeps its label and turns off; the line says it starts', () => {
    const out = card({ kind: 'starting' });
    expect(out).toMatch(/class="acid chat-create" disabled=""><span>READ<\/span>/);
    expect(out).toContain('READ · STARTING…');
  });
  it('refused: the reason in rust, READ live again', () => {
    const out = card({ kind: 'refused', reason: 'the assistant is unloading, try again in a few seconds' });
    expect(out).toMatch(/chat-er[\s\S]*READ REFUSED/);
    expect(out).toContain('try again in a few seconds');
    expect(out).toMatch(/class="acid chat-create"><span>READ/);
  });
  it('superseded and expired: dimmed, no button', () => {
    for (const kind of ['superseded', 'expired'] as const) {
      const out = card({ kind });
      expect(out).toContain('chat-card sup');
      expect(out).not.toContain('<span>READ</span>');
    }
    expect(card({ kind: 'superseded' })).toContain('SUPERSEDED');
  });
  it('done: folds to its header, the reading card follows', () => {
    const out = card({ kind: 'done', partial: false });
    expect(out).toContain('READ · slow_dance_demo.mp3 · THE READING IS BELOW');
    expect(out).not.toContain('<span>READ</span>');
    expect(out).not.toContain('Stays on this machine');
  });
});
