/** The analyze and reading cards' reducer (F-061, D-129): one test per transition, from the server's MessageView and
 * the card's job polls; SEND stays off from READ until the follow-up turn settles. */
import { describe, it, expect } from 'vitest';
import type { ChatMessageView, ChatReadingBody } from './api/chat';
import type { ReadingView } from './api/chatReferences';
import {
  INITIAL_READING, chatReading, readingHoldsSend, readingPartial, replyAfter, runningCards, stepOf, type ReadingEvent, type ReadingState,
} from './chatReading';

const READ: ReadingView = {
  reading_v: 1, readAt: '', seconds: 190, readTo: 190, cut: false, plan: { words: 'service', score: 'service', caption: 'service' },
  words: { language: 'en', lines: ['a'], instrumental: false },
  score: { abc: 'X:1', source: 'transcribed', chords: true, facts: {}, warnings: [] },
  caption: { caption: 'soft piano', bpm: 70, key: 'Am', meter: '4/4' },
};
const analyze = (over: Partial<ChatMessageView> = {}): ChatMessageView => ({
  id: 'a1', seq: 2, role: 'assistant', kind: 'analyze', text: '', proposalId: 'p1', jobId: null, versionId: null, state: 'pending', createdAt: '',
  body: { chat_v: 1, referenceId: 'r1', name: 'demo.mp3', seconds: 190, cut: false, plan: READ.plan, gpuSeconds: 40 }, ...over,
});
const card = (over: Partial<ChatMessageView> = {}, reading: ReadingView | null = null): ChatMessageView => ({
  id: 'c1', seq: 3, role: 'assistant', kind: 'reading', text: '', proposalId: null, jobId: 'rj1', versionId: null, state: 'queued', createdAt: '',
  body: { chat_v: 1, referenceId: 'r1', name: 'demo.mp3', reading, followUp: true } satisfies ChatReadingBody, ...over,
});
const run = (...events: ReadingEvent[]): ReadingState => events.reduce(chatReading, INITIAL_READING);
const phase = (s: ReadingState, id: string) => s.cards[id]?.phase;

describe('chatReading', () => {
  it('an analyze card reads the server: pending, superseded, expired, done', () => {
    for (const state of ['pending', 'superseded', 'expired', 'done'] as const) {
      expect(phase(run({ type: 'thread', messages: [analyze({ state })] }), 'a1')?.kind).toBe(state);
    }
  });

  it('READ pressed → starting (SEND off); the thread still saying pending keeps it starting', () => {
    const s = run({ type: 'thread', messages: [analyze()] }, { type: 'read', messageId: 'a1' }, { type: 'thread', messages: [analyze()] });
    expect(phase(s, 'a1')).toEqual({ kind: 'starting' });
    expect(readingHoldsSend(s)).toBe(true);
  });

  it('READ refused names why and the card is live again (SEND back on)', () => {
    const s = run({ type: 'thread', messages: [analyze()] }, { type: 'read', messageId: 'a1' },
      { type: 'refused', messageId: 'a1', reason: 'a model is still loaded' });
    expect(phase(s, 'a1')).toEqual({ kind: 'refused', reason: 'a model is still loaded' });
    expect(readingHoldsSend(s)).toBe(false);
  });

  it('a reading card queued shows its place; a poll moves it', () => {
    let s = run({ type: 'thread', messages: [card({ job: { status: 'queued', queuePosition: 2 } })] });
    expect(phase(s, 'c1')).toEqual({ kind: 'queued', ahead: 2 });
    s = chatReading(s, { type: 'poll', messageId: 'c1', job: { status: 'queued', queuePosition: 1 } });
    expect(phase(s, 'c1')).toEqual({ kind: 'queued', ahead: 1 });
  });

  it('polls read the step: WORDS 1, SCORE 2, CAPTION 3, with the note after it', () => {
    const s = run({ type: 'thread', messages: [card()] }, { type: 'poll', messageId: 'c1', job: { status: 'running', progressText: 'SCORE · transcribing 41%' } });
    expect(phase(s, 'c1')).toEqual({ kind: 'reading', step: 2, name: 'SCORE', note: 'transcribing 41%' });
    expect(stepOf('caption', 1)).toEqual({ step: 3, name: 'CAPTION', note: null });
    expect(stepOf('unloading', 2)).toEqual({ step: 2, name: 'SCORE', note: 'unloading' });
  });

  it('the server saying reading mid-step keeps the poll\'s step', () => {
    const s = run({ type: 'thread', messages: [card()] }, { type: 'poll', messageId: 'c1', job: { status: 'running', progressText: 'CAPTION' } },
      { type: 'thread', messages: [card({ state: 'reading' })] });
    expect(phase(s, 'c1')).toMatchObject({ kind: 'reading', step: 3 });
  });

  it('the reading saved and the follow-up turn queued/thinking reads PROPOSING… and still holds SEND (D-129)', () => {
    for (const state of ['queued', 'thinking'] as const) {
      const s = run({ type: 'thread', messages: [card({ state, jobId: 'tj1' }, READ)] });
      expect(phase(s, 'c1')).toEqual({ kind: 'proposing' });
      expect(s.cards.c1).toMatchObject({ jobId: 'tj1', stage: 'followUp' });
      expect(readingHoldsSend(s)).toBe(true);
    }
  });

  it('a follow-up turn poll stays PROPOSING…; a cancelled one leaves the reading done', () => {
    let s = run({ type: 'thread', messages: [card({ state: 'thinking', jobId: 'tj1' }, READ)] });
    s = chatReading(s, { type: 'poll', messageId: 'c1', job: { status: 'running', progressText: 'attempt 2 of 3' } });
    expect(phase(s, 'c1')).toEqual({ kind: 'proposing' });
    s = chatReading(s, { type: 'poll', messageId: 'c1', job: { status: 'failed', cancelled: true } });
    expect(phase(s, 'c1')).toEqual({ kind: 'done', partial: false });
  });

  it('done: whole, or partial when a part was not read; SEND is back on', () => {
    expect(phase(run({ type: 'thread', messages: [card({ state: 'done' }, READ)] }), 'c1')).toEqual({ kind: 'done', partial: false });
    const partial = { ...READ, caption: { notRead: 'ACE-Step is not running' } };
    const s = run({ type: 'thread', messages: [card({ state: 'done' }, partial)] });
    expect(phase(s, 'c1')).toEqual({ kind: 'done', partial: true });
    expect(readingHoldsSend(s)).toBe(false);
    expect(readingPartial(partial)).toBe(true);
  });

  it('failed names the job\'s error, else the message text', () => {
    expect(phase(run({ type: 'thread', messages: [card({ state: 'failed', job: { status: 'failed', error: 'the file cannot be read' } })] }), 'c1'))
      .toEqual({ kind: 'failed', error: 'the file cannot be read' });
    expect(phase(run({ type: 'thread', messages: [card({ state: 'failed', text: 'no audio' })] }), 'c1')).toEqual({ kind: 'failed', error: 'no audio' });
  });

  it('cancelled by a poll, cancelled and interrupted from the server', () => {
    const s = run({ type: 'thread', messages: [card()] }, { type: 'poll', messageId: 'c1', job: { status: 'failed', cancelled: true } });
    expect(phase(s, 'c1')).toEqual({ kind: 'cancelled' });
    expect(phase(run({ type: 'thread', messages: [card({ state: 'cancelled' })] }), 'c1')).toEqual({ kind: 'cancelled' });
    expect(phase(run({ type: 'thread', messages: [card({ state: 'interrupted' })] }), 'c1')).toEqual({ kind: 'interrupted' });
  });

  it('a job gone (404) reads interrupted; an ended card ignores it', () => {
    let s = run({ type: 'thread', messages: [card()] }, { type: 'lost', messageId: 'c1' });
    expect(phase(s, 'c1')).toEqual({ kind: 'interrupted' });
    s = run({ type: 'thread', messages: [card({ state: 'done' }, READ)] }, { type: 'lost', messageId: 'c1' });
    expect(phase(s, 'c1')?.kind).toBe('done');
  });

  it('the follow-up\'s reply is the first plain assistant line after the card, before the next user message', () => {
    const reply = { ...analyze(), id: 'r1', kind: 'recipe' as const };
    const user = { ...analyze(), id: 'u2', role: 'user' as const, kind: 'text' as const };
    expect(replyAfter([card(), reply], 'c1')?.id).toBe('r1');
    expect(replyAfter([card(), user, reply], 'c1')).toBeNull();
    expect(replyAfter([card()], 'missing')).toBeNull();
  });

  it('runningCards lists the jobs to follow; a thread without the card drops it', () => {
    let s = run({ type: 'thread', messages: [analyze({ state: 'done' }), card()] });
    expect(runningCards(s)).toEqual([{ messageId: 'c1', jobId: 'rj1' }]);
    s = chatReading(s, { type: 'thread', messages: [] });
    expect(s.cards).toEqual({});
  });
});
