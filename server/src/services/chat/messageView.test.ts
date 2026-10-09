import { describe, it, expect } from 'vitest';
import { RECIPE } from '../../../test-fakes/chatScripts.js';
import { emptyDraft, recipeFields } from './draftModel.js';
import { estSeconds, messageViews, wireDraft, type JobView, type ViewContext } from './messageView.js';
import type { ChatMessage } from './chatTypes.js';

let seq = 0;
const msg = (role: 'user' | 'assistant', kind: ChatMessage['kind'], over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: `m${++seq}`, threadId: 't', seq, role, kind, text: '', body: null, proposalId: null, jobId: null, versionId: null, clientKey: null, createdAt: '', ...over,
});
const ctx = (jobs: Record<string, JobView> = {}, proposals: Record<string, 'live' | 'superseded' | 'scrapped'> = {}): ViewContext => ({
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

  it('C1: a sent mark (the frozen echo) is on the wire; a stale-mark turn reads failed (F-055)', () => {
    const mark = { kind: 'range' as const, versionId: 'v4', bars: [49, 58] as [number, number], seconds: [118, 142] as [number, number], label: 'CHORUS 2 + 2 BARS' };
    const u = msg('user', 'text', { body: { sentRev: 0, mark } });
    const failed = msg('assistant', 'failed', { body: { reasons: ['your mark was on v3; v4 moved those bars · nothing changed · mark again'], cause: 'stale' } });
    const [view] = messageViews([u, failed], ctx());
    expect(view.body).toEqual({ chat_v: 1, sentRev: 0, mark });
    expect(states([u, failed], ctx())).toEqual(['failed', 'failed']);
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
    expect(wireDraft(emptyDraft()).fields).toEqual({ title: null, style: null, bpm: null, key: null, timeSignature: null, language: null, structure: [], lyrics: [], engine: 'yue2', vocals: 'sung' });
  });

  it('the estimate: 2 bars a sung line, 8 a section without lines', () => {
    // Intro 8 + 4 sections of 4 lines (32 bars) + Outro 4 lines (8 bars) = 48 bars of 4/4 at 68 bpm.
    expect(estSeconds(recipeFields(RECIPE))).toBe(Math.round((48 * 4 * 60) / 68));
    expect(estSeconds({})).toBeNull();
  });

  it('an edit card (CB-2): pending, REPLACED by the next plan, expired when its plan is gone; committing and done follow its APPLY job', () => {
    const card = (over: Partial<ChatMessage> = {}) => msg('assistant', 'edit', { proposalId: 'e', ...over });
    expect(states([card()], ctx({}, { e: 'live' }))).toEqual(['pending']);
    expect(states([card()], ctx({}, { e: 'superseded' }))).toEqual(['superseded']);
    expect(states([card()], ctx())).toEqual(['expired']);
    expect(states([card()], ctx({}, { e: 'scrapped' }))).toEqual(['scrapped']); // D-258: a start over that planned nothing
    expect(states([card({ jobId: 'r' })], ctx({ r: { status: 'running' } }, { e: 'live' }))).toEqual(['committing']);
    expect(states([card({ jobId: 'r' }), msg('assistant', 'version', { jobId: 'r' })], ctx())).toEqual(['done', null]);
  });

  it('an edit card whose APPLY a restart cut (its job id kept, the job unknown, no version) is interrupted, not expired (F-049 #3)', () => {
    const card = (over: Partial<ChatMessage> = {}) => msg('assistant', 'edit', { proposalId: 'e', ...over });
    expect(states([card({ jobId: 'r' })], ctx())).toEqual(['interrupted']);
    expect(states([card({ jobId: 'r' })], ctx({ r: { status: 'failed', error: 'x' } }))).toEqual(['expired']);
    expect(states([msg('assistant', 'recipe', { proposalId: 'e', jobId: 'r', body: recipeBody as never })], ctx())).toEqual(['expired']);
  });

  it('an edit card\'s APPLY (CB-3, F-049): the phase while committing, back to pending when it ended with no version, stale when refused', () => {
    const card = (over: Partial<ChatMessage> = {}) => msg('assistant', 'edit', { proposalId: 'e', jobId: 'r', ...over });
    const phase = (job: JobView) => messageViews([card()], ctx({ r: job }, { e: 'live' }))[0].phase;
    expect(phase({ status: 'queued', queuePosition: 2 })).toBe('queued');
    expect(phase({ status: 'loading' })).toBe('queued');
    expect(phase({ status: 'running', progressText: 'rendering' })).toBe('rendering');
    expect(phase({ status: 'running', progressText: 'splicing' })).toBe('splicing');
    expect(phase({ status: 'running', progressText: 'saving' })).toBe('saving');
    expect(phase({ status: 'failed', error: 'YuE2 out of memory' })).toBeNull();
    expect(states([card()], ctx({ r: { status: 'failed', error: 'Aborted' } }, { e: 'live' }))).toEqual(['pending']);
    expect(messageViews([msg('assistant', 'recipe', { body: recipeBody as never })], ctx())[0].phase).toBeNull();
    const stale = card({ jobId: null, body: { planId: 'p', stale: 'this song changed since the proposal' } as never });
    expect(states([stale], ctx({}, { e: 'live' }))).toEqual(['stale']);
    expect(states([stale], ctx({}, { e: 'superseded' }))).toEqual(['superseded']);
  });

  it('a version card offers A/B only while the version before it exists (F-048 edge)', () => {
    const body = { seconds: 192, label: 'x', number: 2, truncated: false, whole: false, splice: null, fallback: null, previous: { versionId: 'v1', number: 1 } };
    const v = msg('assistant', 'version', { body: body as never, versionId: 'v2' });
    expect((messageViews([v], ctx())[0].body as typeof body).previous).toEqual({ versionId: 'v1', number: 1 });
    expect((messageViews([v], { ...ctx(), versionExists: (id) => id !== 'v1' })[0].body as typeof body).previous).toBeNull();
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

  it('C2 (F-059): UNDO TURN is offered on a recipe with an undo record, done once undone, absent otherwise', () => {
    const undo = { rev: 1, before: {}, fields: ['title' as const] };
    const recipe = (body: object, over: Partial<ChatMessage> = {}) => msg('assistant', 'recipe', { proposalId: 'p', body: { ...recipeBody, ...body }, ...over });
    const offers = (messages: ChatMessage[], c: ViewContext) => messageViews(messages, c).map((m) => m.undo);
    expect(offers([recipe({ undo })], ctx({}, { p: 'live' }))).toEqual(['offer']);
    expect(offers([recipe({ undo })], ctx())).toEqual(['offer']); // expired after a restart: the record still undoes
    expect(offers([recipe({ undo, undone: { at: 1, restored: ['title'], kept: [] } })], ctx())).toEqual(['done']);
    expect(offers([recipe({})], ctx())).toEqual([null]); // filled nothing, or a pre-C2 message
    expect(offers([recipe({ undo })], { ...ctx(), hasSong: true })).toEqual([null]);
    const made = recipe({ undo }, { jobId: 'take' });
    expect(offers([made, msg('assistant', 'song', { jobId: 'take' })], ctx())).toEqual([null, null]);
    expect(offers([msg('assistant', 'say')], ctx())).toEqual([null]);
  });
});
