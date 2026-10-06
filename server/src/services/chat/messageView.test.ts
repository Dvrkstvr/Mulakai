import { describe, it, expect } from 'vitest';
import { RECIPE } from '../../../test-fakes/chatScripts.js';
import { emptyDraft, recipeFields } from './draftModel.js';
import { estSeconds, messageViews, wireDraft, type JobView, type ViewContext } from './messageView.js';
import type { ChatMessage } from './chatTypes.js';

let seq = 0;
const msg = (role: 'user' | 'assistant', kind: ChatMessage['kind'], over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: `m${++seq}`, threadId: 't', seq, role, kind, text: '', body: null, proposalId: null, jobId: null, versionId: null, clientKey: null, createdAt: '', ...over,
});
const ctx = (jobs: Record<string, JobView> = {}, proposals: Record<string, 'live' | 'superseded'> = {}): ViewContext => ({
  job: (id) => jobs[id], proposal: (id) => proposals[id] ?? null,
});
const states = (messages: ChatMessage[], c: ViewContext) => messageViews(messages, c).map((m) => m.state);
const recipeBody = { recipe: RECIPE, assumptions: [], changed: [], skipped: [] };

describe('message view (the states the client shows)', () => {
  it('a user message follows its turn job, then the reply after it', () => {
    const u = msg('user', 'text', { jobId: 'j1' });
    expect(states([u], ctx({ j1: { status: 'queued', queuePosition: 2 } }))).toEqual(['queued']);
    expect(states([u], ctx({ j1: { status: 'running' } }))).toEqual(['thinking']);
    expect(states([u, msg('assistant', 'say')], ctx())).toEqual(['done', null]);
    expect(states([u, msg('assistant', 'failed', { body: { reasons: ['x'], cause: 'check' } })], ctx())).toEqual(['failed', 'failed']);
    expect(states([u, msg('assistant', 'failed', { body: { reasons: ['x'], cause: 'cancelled' } })], ctx())).toEqual(['cancelled', 'cancelled']);
  });

  it('a job that vanished with no reply (a restart) is interrupted; a trashed-song cancel reads cancelled', () => {
    expect(states([msg('user', 'text', { jobId: 'gone' })], ctx())).toEqual(['interrupted']);
    expect(states([msg('user', 'text', { jobId: 'j' })], ctx({ j: { status: 'failed', cancelled: true } }))).toEqual(['cancelled']);
  });

  it('a song card landing between a message and its reply is not the reply', () => {
    const u = msg('user', 'text', { jobId: 'j' });
    expect(states([u, msg('assistant', 'song')], ctx({ j: { status: 'running' } }))[0]).toBe('thinking');
  });

  it('a recipe card: pending, superseded, expired after a restart, committing, done', () => {
    const card = (over: Partial<ChatMessage> = {}) => msg('assistant', 'recipe', { proposalId: 'p', body: recipeBody, ...over });
    expect(states([card()], ctx({}, { p: 'live' }))).toEqual(['pending']);
    expect(states([card()], ctx({}, { p: 'superseded' }))).toEqual(['superseded']);
    expect(states([card()], ctx())).toEqual(['expired']);
    expect(states([card({ jobId: 'c' })], ctx({ c: { status: 'running' } }, { p: 'live' }))).toEqual(['committing']);
    expect(states([card({ jobId: 'c' })], ctx({ c: { status: 'failed', error: 'YUE2 -> HTTP 500' } }, { p: 'live' }))).toEqual(['pending']);
    expect(states([card({ jobId: 'c' }), msg('assistant', 'song', { jobId: 'c' })], ctx())).toEqual(['done', null]);
  });

  it('wire shapes: a recipe card camel-cased with its estimate, bodies with chat_v, draft fields filled', () => {
    const [view] = messageViews([msg('assistant', 'recipe', { proposalId: 'p', body: recipeBody })], ctx({}, { p: 'live' }));
    expect(view.body).toMatchObject({ chat_v: 1, recipe: { timeSignature: '4/4', title: RECIPE.title }, estSeconds: estSeconds(recipeFields(RECIPE)) });
    expect(wireDraft(emptyDraft()).fields).toEqual({ title: null, style: null, bpm: null, key: null, timeSignature: null, language: null, structure: [], lyrics: [], engine: 'yue2' });
  });

  it('the estimate: 2 bars a sung line, 8 a section without lines', () => {
    // Intro 8 + 4 sections of 4 lines (32 bars) + Outro 4 lines (8 bars) = 48 bars of 4/4 at 68 bpm.
    expect(estSeconds(recipeFields(RECIPE))).toBe(Math.round((48 * 4 * 60) / 68));
    expect(estSeconds({})).toBeNull();
  });

  it('an analyze card: pending, superseded, expired; committing while its READ job runs, then done (C3)', () => {
    const card = (over: Partial<ChatMessage> = {}) => msg('assistant', 'analyze', { proposalId: 'a', ...over });
    expect(states([card()], ctx({}, { a: 'live' }))).toEqual(['pending']);
    expect(states([card()], ctx({}, { a: 'superseded' }))).toEqual(['superseded']);
    expect(states([card()], ctx())).toEqual(['expired']);
    expect(states([card({ jobId: 'r' })], ctx({ r: { status: 'queued' } }, { a: 'live' }))).toEqual(['committing']);
    expect(states([card({ jobId: 'r' })], ctx({ r: { status: 'running' } }))).toEqual(['committing']);
    expect(states([card({ jobId: 'r' })], ctx({ r: { status: 'failed', error: 'x' } }, { a: 'live' }))).toEqual(['done']);
    expect(states([card({ jobId: 'r' })], ctx())).toEqual(['done']);
  });

  it('an analyze card whose reading ended with nothing saved is readable again while its proposal lives (C3 review 3)', () => {
    const card = msg('assistant', 'analyze', { proposalId: 'a', jobId: 'r' });
    const reading = (saved: unknown, jobId = 'r') => msg('assistant', 'reading', { jobId, body: { referenceId: 'ref', name: 'x', followUp: true, reading: saved } as never });
    expect(states([card, reading(null)], ctx({ r: { status: 'failed', error: 'the file is gone' } }, { a: 'live' }))).toEqual(['pending', 'failed']);
    expect(states([card, reading(null)], ctx({ r: { status: 'failed', cancelled: true } }, { a: 'live' }))).toEqual(['pending', 'cancelled']);
    expect(states([card, reading(null)], ctx({ r: { status: 'failed' } }))).toEqual(['expired', 'failed']);
    expect(states([card, reading(null)], ctx({ r: { status: 'running' } }, { a: 'live' }))[0]).toBe('committing');
    expect(states([card, reading({ reading_v: 1 })], ctx({ r: { status: 'failed', error: 'still loaded' } }, { a: 'live' }))[0]).toBe('done');
    expect(states([card, reading({ reading_v: 1 }, 't')], ctx({ r: { status: 'done' }, t: { status: 'done' } }, { a: 'live' }))[0]).toBe('done');
  });

  it('a reading card: queued, reading, then the follow-up turn (queued / thinking), done; failed, cancelled, interrupted', () => {
    const body = (reading: unknown) => ({ referenceId: 'ref', name: 'take.wav', followUp: true, reading }) as never;
    const card = (reading: unknown, jobId = 'j') => msg('assistant', 'reading', { body: body(reading), jobId });
    const read = { reading_v: 1 };
    expect(states([card(null)], ctx({ j: { status: 'queued', queuePosition: 1 } }))).toEqual(['queued']);
    expect(states([card(null)], ctx({ j: { status: 'loading' } }))).toEqual(['reading']);
    expect(states([card(null)], ctx({ j: { status: 'running' } }))).toEqual(['reading']);
    expect(states([card(null)], ctx({ j: { status: 'failed', error: 'the file is gone' } }))).toEqual(['failed']);
    expect(states([card(null)], ctx({ j: { status: 'failed', error: 'cancelled', cancelled: true } }))).toEqual(['cancelled']);
    expect(states([card(null)], ctx())).toEqual(['interrupted']);
    expect(states([card(read, 't')], ctx({ t: { status: 'queued' } }))).toEqual(['queued']);
    expect(states([card(read, 't')], ctx({ t: { status: 'running' } }))).toEqual(['thinking']);
    expect(states([card(read, 't')], ctx({ t: { status: 'done' } }))).toEqual(['done']);
    expect(states([card(read, 't')], ctx({ t: { status: 'failed', error: 'x' } }))).toEqual(['done']);
    expect(states([card(read, 't')], ctx())).toEqual(['done']);
  });
});
