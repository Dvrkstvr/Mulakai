/** The turn reducer, one test per transition (scope.md "A turn, end to end"; F-042, F-043, F-049). */
import { describe, it, expect } from 'vitest';
import type { ChatMessageView } from './api/chat';
import {
  INITIAL_TURN, canRetry, canSend, chatCommit, chatTurn, lastTurn, turnRunning, type CommitEvent, type CommitState, type TurnEvent, type TurnState,
} from './chatTurn';

const msg = (over: Partial<ChatMessageView>): ChatMessageView => ({
  id: 'm1', seq: 1, role: 'user', kind: 'text', text: 'a slow Spanish ballad', body: null, proposalId: null,
  jobId: 'j1', versionId: null, state: 'done', createdAt: '2026-10-06T10:00:00Z', ...over,
});
const run = (s: TurnState, ...events: TurnEvent[]) => events.reduce(chatTurn, s);
const typed = run(INITIAL_TURN, { type: 'type', text: '  a slow Spanish ballad ' });
const sending = run(typed, { type: 'send', clientKey: 'k1' });
const queued = run(sending, { type: 'accepted', jobId: 'j1', messageId: 'm1', position: 2 });
const thinking = run(sending, { type: 'accepted', jobId: 'j1', messageId: 'm1', position: 0 });
const failedReply = (cause: string, reasons: string[]) =>
  msg({ id: 'm2', role: 'assistant', kind: 'failed', text: 'no answer', body: { chat_v: 1, cause, reasons }, state: null });

describe('chatTurn', () => {
  it('composing: typing keeps the text and clears a refused POST\'s error', () => {
    const s = run({ ...INITIAL_TURN, error: 'queue full' }, { type: 'type', text: 'hi' });
    expect(s).toMatchObject({ phase: { kind: 'composing' }, text: 'hi', error: null });
  });

  it('composing → sending: SEND keeps the key and the trimmed text; empty text or a second SEND do nothing', () => {
    expect(sending).toMatchObject({ phase: { kind: 'sending' }, clientKey: 'k1', lastText: 'a slow Spanish ballad' });
    expect(run(INITIAL_TURN, { type: 'send', clientKey: 'k1' })).toBe(INITIAL_TURN);
    expect(run(sending, { type: 'send', clientKey: 'k2' })).toBe(sending);
  });

  it('sending → queued "STARTS AFTER n" (position > 0) and the composer clears', () => {
    expect(queued).toMatchObject({ phase: { kind: 'queued', ahead: 2 }, text: '', jobId: 'j1', messageId: 'm1', clientKey: null });
  });

  it('sending → thinking attempt 1 when the slot was free', () => {
    expect(thinking.phase).toEqual({ kind: 'thinking', attempt: 1, note: null });
  });

  it('sending → composing on a refused POST: text and key kept, so a resend is the same message', () => {
    const s = run(sending, { type: 'type', text: '' }, { type: 'refused', error: 'the queue is full' });
    expect(s).toMatchObject({ phase: { kind: 'composing' }, text: 'a slow Spanish ballad', clientKey: 'k1', error: 'the queue is full' });
    expect(run(s, { type: 'send', clientKey: 'k9' }).clientKey).toBe('k1');
  });

  it('queued → queued with the new position, then → thinking when the job takes the slot', () => {
    const q = run(queued, { type: 'poll', job: { status: 'queued', queuePosition: 1 } });
    expect(q.phase).toEqual({ kind: 'queued', ahead: 1 });
    expect(run(q, { type: 'poll', job: { status: 'loading' } }).phase).toEqual({ kind: 'thinking', attempt: 1, note: null });
  });

  it('thinking → thinking "attempt 2 of 3" with the retry reason; the unload is a note on the same attempt', () => {
    const t = run(thinking, { type: 'poll', job: { status: 'running', progressText: 'attempt 2 of 3 · bad key H#' } });
    expect(t.phase).toEqual({ kind: 'thinking', attempt: 2, note: 'bad key H#' });
    const u = run(t, { type: 'poll', job: { status: 'running', progressText: 'unloading the planner' } });
    expect(u.phase).toEqual({ kind: 'thinking', attempt: 2, note: 'unloading the planner' });
  });

  it('a finished poll changes nothing: the thread refetch settles it', () => {
    expect(run(thinking, { type: 'poll', job: { status: 'done' } })).toBe(thinking);
  });

  it('thinking → outcome with the reply message', () => {
    const reply = msg({ id: 'm2', role: 'assistant', kind: 'recipe', state: 'pending' });
    const s = run(thinking, { type: 'settled', user: msg({}), reply });
    expect(s).toMatchObject({ phase: { kind: 'outcome', replyId: 'm2' }, clientKey: null, cancelling: false });
  });

  it('thinking → failed with the reasons ("nothing changed", RETRY with the same text)', () => {
    const s = run(thinking, { type: 'settled', user: msg({ state: 'failed' }), reply: failedReply('check', ['bad key H#', 'bpm 300']) });
    expect(s.phase).toEqual({ kind: 'failed', reasons: ['bad key H#', 'bpm 300'], cause: 'check' });
    expect(canRetry(s, true)).toBe(true);
    expect(run(s, { type: 'retry', clientKey: 'k2' })).toMatchObject({ phase: { kind: 'sending' }, clientKey: 'k2' });
  });

  it('thinking → offline when the planner did not answer (ASSISTANT OFF with the cause)', () => {
    const s = run(thinking, { type: 'settled', user: msg({ state: 'failed' }), reply: failedReply('offline', ['Ollama did not answer']) });
    expect(s.phase).toEqual({ kind: 'offline', cause: 'Ollama did not answer' });
  });

  it('queued → cancelling on CANCEL → cancelled when the poll says the job left the line', () => {
    const c = run(queued, { type: 'cancel' });
    expect(c.cancelling).toBe(true);
    expect(run(c, { type: 'poll', job: { status: 'failed', cancelled: true } })).toMatchObject({ phase: { kind: 'cancelled' }, cancelling: false });
  });

  it('thinking → cancelled once the server has unloaded and marked the message', () => {
    const s = run(thinking, { type: 'cancel' }, { type: 'settled', user: msg({ state: 'cancelled' }), reply: null });
    expect(s).toMatchObject({ phase: { kind: 'cancelled' }, cancelling: false });
    expect(run(INITIAL_TURN, { type: 'cancel' })).toBe(INITIAL_TURN);
  });

  it('cancelled → RETRY resends the same text as a new message (TU-2: every ending without an answer has one RETRY)', () => {
    const s = run(queued, { type: 'cancel' }, { type: 'poll', job: { status: 'failed', cancelled: true } });
    expect(canRetry(s, true)).toBe(true);
    expect(canRetry(s, false)).toBe(false);
    expect(run(s, { type: 'retry', clientKey: 'k3' })).toMatchObject({ phase: { kind: 'sending' }, clientKey: 'k3', lastText: s.lastText });
    // A reload restores a cancelled message with its text: RETRY works from there too.
    const restored = run(INITIAL_TURN, { type: 'settled', user: msg({ state: 'cancelled', text: 'slower, in Spanish' }), reply: null });
    expect(canRetry(restored, true)).toBe(true);
  });

  it('queued / thinking → interrupted when the job is lost; nothing else is', () => {
    expect(run(thinking, { type: 'lost' }).phase).toEqual({ kind: 'interrupted' });
    expect(run(INITIAL_TURN, { type: 'lost' })).toBe(INITIAL_TURN);
  });

  it('a reload restores the running phase from the thread, and the restart\'s interrupted', () => {
    expect(run(INITIAL_TURN, { type: 'settled', user: msg({ state: 'thinking' }), reply: null }))
      .toMatchObject({ phase: { kind: 'thinking', attempt: 1 }, jobId: 'j1', messageId: 'm1', lastText: 'a slow Spanish ballad' });
    expect(run(INITIAL_TURN, { type: 'settled', user: msg({ state: 'interrupted' }), reply: null }).phase).toEqual({ kind: 'interrupted' });
  });

  it('a thread still saying queued does not undo what the polls know', () => {
    const t = run(thinking, { type: 'poll', job: { status: 'running', progressText: 'attempt 2 of 3' } });
    expect(run(t, { type: 'settled', user: msg({ state: 'queued' }), reply: null }).phase).toEqual(t.phase);
  });

  it('reset (NEW CHAT, another thread) → composing, empty', () => {
    expect(run(queued, { type: 'reset' })).toBe(INITIAL_TURN);
  });

  it('SEND needs text, no running turn and the assistant on (F-043)', () => {
    expect(canSend(typed, true)).toBe(true);
    expect(canSend(typed, false)).toBe(false);
    expect(canSend(queued, true)).toBe(false);
    expect(turnRunning(sending)).toBe(true);
  });

  it('lastTurn finds the last user message and the assistant reply after it', () => {
    const msgs = [msg({ id: 'a' }), msg({ id: 'b', role: 'assistant', kind: 'say' }), msg({ id: 'c' })];
    expect(lastTurn(msgs)).toEqual({ user: msgs[2], reply: null });
    expect(lastTurn(msgs, 'a')).toEqual({ user: msgs[0], reply: msgs[1] });
    expect(lastTurn([])).toBeNull();
  });
  it('lastTurn skips a song card that landed between the message and its reply (a turn sent while a take ran)', () => {
    const msgs = [msg({ id: 'a' }), msg({ id: 's', role: 'assistant', kind: 'song' }), msg({ id: 'r', role: 'assistant', kind: 'say' })];
    expect(lastTurn(msgs, 'a')?.reply?.id).toBe('r');
    expect(lastTurn(msgs.slice(0, 2), 'a')?.reply).toBeNull();
  });
});

describe('chatCommit (CREATE SONG\'s take, F-044)', () => {
  const commit = (s: CommitState | null, ...events: CommitEvent[]) => events.reduce(chatCommit, s);
  const started = commit(null, { type: 'start', proposalId: 'p1' }, { type: 'started', jobId: 'g1' });

  it('start → starting; a second press while it runs is ignored', () => {
    const s = commit(null, { type: 'start', proposalId: 'p1' });
    expect(s).toEqual({ proposalId: 'p1', jobId: null, phase: { kind: 'starting' } });
    expect(commit(started, { type: 'start', proposalId: 'p2' })).toBe(started);
  });

  it('started → queued, then the polls: queue position, YuE2 running with its progress', () => {
    expect(started).toEqual({ proposalId: 'p1', jobId: 'g1', phase: { kind: 'queued', ahead: 0 } });
    expect(commit(started, { type: 'poll', job: { status: 'queued', queuePosition: 2 } })?.phase).toEqual({ kind: 'queued', ahead: 2 });
    expect(commit(started, { type: 'poll', job: { status: 'running', progressText: 'stage 1 41%' } })?.phase)
      .toEqual({ kind: 'running', progressText: 'stage 1 41%' });
  });

  it('done or cancelled → nothing (the song card lands); failed → the error, and CREATE SONG is live again', () => {
    expect(commit(started, { type: 'poll', job: { status: 'done' } })).toBeNull();
    expect(commit(started, { type: 'poll', job: { status: 'failed', cancelled: true } })).toBeNull();
    const failed = commit(started, { type: 'poll', job: { status: 'failed', error: 'YuE2 ran out of memory' } });
    expect(failed).toEqual({ proposalId: 'p1', jobId: null, phase: { kind: 'failed', error: 'YuE2 ran out of memory' } });
    expect(commit(failed, { type: 'start', proposalId: 'p1' })?.phase).toEqual({ kind: 'starting' });
  });

  it('refused by the server\'s re-check → failed with its reason, no job', () => {
    const s = commit(null, { type: 'start', proposalId: 'p1' }, { type: 'refused', error: 'this proposal expired, ask again' });
    expect(s?.phase).toEqual({ kind: 'failed', error: 'this proposal expired, ask again' });
  });

  it('a reload restores a committing card\'s job as running', () => {
    expect(commit(null, { type: 'restore', proposalId: 'p1', jobId: 'g1' })).toEqual({ proposalId: 'p1', jobId: 'g1', phase: { kind: 'running', progressText: null } });
    expect(commit(null, { type: 'poll', job: { status: 'running' } })).toBeNull();
  });
});
