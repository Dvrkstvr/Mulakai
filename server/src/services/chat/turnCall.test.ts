import { describe, it, expect, vi } from 'vitest';
import { RECIPE, autoLyrics, badKeyRecipe, notJson, outOfSet, recipeReply, sayReply } from '../../../test-fakes/chatScripts.js';
import { recipeFields } from './draftModel.js';
import { MAX_TOKENS, decideReply, ladderRung, type TurnContext } from './turnCall.js';
import { turnAttempts } from './turnAttempts.js';
import type { ChatScript } from '../../../test-fakes/fakeOllama.js';
import { contract } from '../../../test-fakes/fakeYue.js';
import type { ChatMessage as PromptMessage, ScoreFacts } from '../score/planTypes.js';
import { promptChars } from '../score/plannerPrompt.js';
import { NOTHING_REVISED } from '../score/planRevise.js';
import { chatPendingLines } from './turnRevise.js';
import type { RevisePending } from './convergeTypes.js';
import type { Op, Plan } from '../score/planTypes.js';

const ctx: TurnContext = { state: { hasSong: false, scoreReadable: false }, block: ['SONG: none yet'], facts: null, request: 'a sad song', pending: false, draft: {}, history: [] };
/** A lyrics call (LD) is answered by autoLyrics; the turn's calls from `replies`. */
const scripted = (...replies: ChatScript[]) => {
  const ask = vi.fn(async (m: unknown, _s?: unknown, _o?: { maxTokens: number; model?: string }) => {
    const msgs = m as Array<{ content: string }>;
    const r = msgs[0]?.content?.startsWith('You write song lyrics') ? autoLyrics(msgs) : replies.length > 1 ? replies.shift()! : replies[0];
    return { content: r.content ?? '', promptTokens: r.promptTokens ?? null };
  });
  return ask;
};

describe('decideReply (rung 0: one call, the full schema)', () => {
  it('a valid recipe on the first try is one call, plus its lyrics call (LD)', async () => {
    const ask = scripted(recipeReply());
    const d = await decideReply(ctx, { ask });
    expect(d).toMatchObject({ ok: true, attempts: 1, calls: 2, promptTokens: [2000] });
    expect(ask.mock.calls[0][1]).toHaveProperty('anyOf');
  });

  it('feeds the reasons back and reports progress "attempt n of 3 · reason"', async () => {
    const ask = scripted(notJson(), badKeyRecipe(), recipeReply());
    const progress: string[] = [];
    const d = await decideReply(ctx, { ask, onAttempt: (n, r) => progress.push(`${n}${r ? ` · ${r}` : ''}`) });
    expect(d).toMatchObject({ ok: true, attempts: 3, calls: 4 });
    // CB-2: the refused attempts travel with the reply, so an edit card says what a retry moved (D-060).
    expect(d.ok && d.refusals).toEqual([['the reply is not valid JSON'], ['key "Aminor" is not one of the 30 key names (C, Am, F#m ...)']]);
    expect(progress).toEqual(['1', '2 · the reply is not valid JSON', '3 · key "Aminor" is not one of the 30 key names (C, Am, F#m ...)']);
    const last = ask.mock.calls[2][0] as Array<{ content: string }>;
    expect(last.at(-1)!.content).toContain('- key "Aminor" is not one of the 30 key names');
  });

  it('three replies outside the set end with the reason, no reply', async () => {
    const d = await decideReply(ctx, { ask: scripted(outOfSet()) });
    expect(d).toMatchObject({ ok: false, attempts: 3, calls: 3, reasons: ['action "dance" is not one of ask, recipe, edit, scalpel, analyze, say'] });
  });

  it('a thrown call ends the turn at once', async () => {
    const ask = vi.fn(async () => { throw new Error('planner offline'); });
    await expect(decideReply(ctx, { ask })).rejects.toThrow('planner offline');
    expect(ask).toHaveBeenCalledOnce();
  });

  it('rung 2 offers only what the state allows: no edit without a song', async () => {
    const ask = scripted(sayReply());
    await decideReply(ctx, { ask, rung: 2 });
    const schema = ask.mock.calls[0][1] as { anyOf: Array<{ properties: { action: { const: string } } }> };
    expect(schema.anyOf.map((p) => p.properties.action.const)).toEqual(['ask', 'recipe', 'analyze', 'say']);
  });

  it('asks 4000 completion tokens when the reply may be an edit, 2000 when it cannot (rung 2, no song)', async () => {
    const ask = scripted(sayReply());
    await decideReply(ctx, { ask });
    await decideReply(ctx, { ask, rung: 2 });
    expect(ask.mock.calls.map((c) => c[2])).toEqual([{ maxTokens: MAX_TOKENS.edit }, { maxTokens: MAX_TOKENS.other }]);
    expect(MAX_TOKENS).toEqual({ edit: 4000, other: 2000, lyrics: 4000 });
  });

  it('a live card goes in as the PENDING PROPOSAL with the draft fields; no live card, the sidebar', async () => {
    const ask = scripted(recipeReply());
    const d = await decideReply({ ...ctx, pending: true, draft: recipeFields(RECIPE) }, { ask });
    expect(d.messages[1].content).toContain('PENDING PROPOSAL (the new-song card the person is looking at; nothing has run):\ntitle: Luz sobre el mar');
    const e = await decideReply({ ...ctx, pending: false, draft: { title: 'Mar' } }, { ask });
    expect(e.messages[1].content).toContain('SIDEBAR (the new-song fields as they are now; the person may have edited them by hand):\ntitle: Mar');
  });

  it('C3: a reading in the state brings reference_use and the REFERENCE rule; a follow-up offers ask, recipe, say (D-128, D-129)', async () => {
    const ask = scripted(recipeReply());
    const d = await decideReply({ ...ctx, state: { ...ctx.state, referenceRead: true, followUp: true } }, { ask });
    const schema = ask.mock.calls[0][1] as { anyOf: Array<{ properties: { action: { const: string }; recipe?: { properties: Record<string, unknown> } } }> };
    expect(schema.anyOf.map((p) => p.properties.action.const)).toEqual(['ask', 'recipe', 'say']);
    expect(schema.anyOf[1].properties.recipe!.properties).toHaveProperty('reference_use');
    expect(d.messages[0].content).toContain('reference_use');
    await decideReply(ctx, { ask });
    expect(ask.mock.calls[2][0][0].content).not.toContain('reference_use'); // calls 0-1: the first turn's recipe and lyrics
  });

  it('CHAT_LADDER picks a built rung; anything else is rung 0', () => {
    expect(ladderRung(undefined)).toBe(0);
    expect(ladderRung('2')).toBe(2);
    expect(ladderRung('1')).toBe(0);
    expect(ladderRung('x')).toBe(0);
  });

  it('turnAttempts stops after maxAttempts', async () => {
    const out = await turnAttempts([], { ask: async () => ({ content: '{}', promptTokens: 1 }), check: async () => ({ ok: false, reasons: ['no'] }) }, 2);
    expect(out).toEqual({ ok: false, reasons: ['no'], attempts: 2, promptTokens: [1, 1] });
  });

  it('C1 live B2: "make this jazzier" on a chorus mark: EDIT STYLE is left out and retried with the mark’s bars; the replan stays inside', async () => {
    const facts = contract('read-ok').response.body.facts as ScoreFacts;
    const marked: TurnContext = { ...ctx, state: { hasSong: true, scoreReadable: true }, facts, request: 'make this jazzier', mark: { lines: ['MARK: bars 23-30'], range: [23, 30] } };
    const reharm = { op: 'REHARMONIZE', from_bar: 23, to_bar: 24, chords: [{ bar: 23, beat: 1, root: 'C', quality: 'maj7' }] };
    const edit = (ops: unknown[]) => ({ content: JSON.stringify({ action: 'edit', message: 'jazzier', assumptions: [], ops }), promptTokens: 1 });
    const ask = scripted(edit([{ op: 'EDIT_STYLE', style: 'jazz' }, reharm]), edit([reharm]));
    const d = await decideReply(marked, { ask });
    expect(d).toMatchObject({ ok: true, attempts: 2 });
    expect(d.ok && d.reply).toMatchObject({ action: 'edit', ops: [reharm] });
    expect(d.ok && d.refusals[0][0]).toContain('the mark covers bars 23-30, and a whole-song change needs the person to ask for it');
    expect(JSON.stringify(ask.mock.calls[0][1])).not.toContain('EDIT_STYLE');
    const whole = scripted(edit([{ op: 'EDIT_STYLE', style: 'jazz' }]));
    expect(await decideReply({ ...marked, request: 'make the whole song jazzier' }, { ask: whole })).toMatchObject({ ok: true, attempts: 1 });
    expect(JSON.stringify(whole.mock.calls[0][1])).toContain('EDIT_STYLE');
  });
  it('C1 re-check N4: a marked turn refused twice keeps attempt 3 within 1k tokens (chars / 4) of attempt 1', async () => {
    const facts = contract('read-ok').response.body.facts as ScoreFacts;
    const marked: TurnContext = { ...ctx, state: { hasSong: true, scoreReadable: true }, facts, request: 'make it jazzier', mark: { lines: ['MARK: bars 23-30'], range: [23, 30] } };
    // The live failure's shape: a whole-song REHARMONIZE (2 chords a bar) and a long message, refused for leaving the mark.
    const chords = Array.from({ length: 128 }, (_, i) => ({ bar: 1 + (i >> 1), beat: 1 + 2 * (i % 2), root: 'A', quality: 'm7' }));
    const big = JSON.stringify({ action: 'edit', message: 'm'.repeat(300), assumptions: ['a'], ops: [{ op: 'REHARMONIZE', from_bar: 1, to_bar: 64, chords }] });
    const ask = scripted({ content: big, promptTokens: null });
    const d = await decideReply(marked, { ask });
    expect(d).toMatchObject({ ok: false, attempts: 3 });
    const tokens = ask.mock.calls.map((c) => Math.round(promptChars(c[0] as PromptMessage[]) / 4));
    expect(big.length / 4).toBeGreaterThan(1500);
    expect(tokens[2]).toBeLessThanOrEqual(tokens[0] + 1000); // 2434, 2529, 2623 (re-sending the reply: 2434, 4062, 5689)
    expect(JSON.stringify(ask.mock.calls[2][0])).not.toContain('m'.repeat(300));
  });

  it('C1 re-check N2: "make it faster" on a mark: SET TEMPO refused, the REHARMONIZE replan does not keep the tempo sentence', async () => {
    const facts = contract('read-ok').response.body.facts as ScoreFacts;
    const marked: TurnContext = { ...ctx, state: { hasSong: true, scoreReadable: true }, facts, request: 'make it faster', mark: { lines: ['MARK: bars 23-30'], range: [23, 30] } };
    const said = 'I will increase the tempo of the whole song to 120 bpm.';
    const reharm = { op: 'REHARMONIZE', from_bar: 23, to_bar: 24, chords: [{ bar: 23, beat: 1, root: 'C', quality: 'maj7' }] };
    const edit = (ops: unknown[]) => ({ content: JSON.stringify({ action: 'edit', message: said, assumptions: [], ops }), promptTokens: 1 });
    const ask = scripted(edit([{ op: 'SET_TEMPO', bpm: 120 }]), edit([reharm]));
    const d = await decideReply(marked, { ask });
    expect(d).toMatchObject({ ok: true, attempts: 2, reply: { action: 'edit', ops: [reharm] } });
    expect(d.ok && d.reply.message).toBe('Planned inside the mark: new chords in bars 23-24. SET TEMPO would change the whole song, so it is not in this plan; ask for the whole song to get it.');
    expect(JSON.stringify(ask.mock.calls[1][0])).not.toContain(said);
  });
});

describe('decideReply with a pending plan (C2, F-058: REVISE as a follow-up turn)', () => {
  const facts = contract('read-ok').response.body.facts as ScoreFacts;
  const [TEMPO, HARM] = contract('apply-compound').request.body.ops as Op[];
  const plan = { id: 'p1', request: 'faster', ops: [TEMPO], verdicts: [{ index: 1, op: 'SET_TEMPO', ok: true, reason: null }], revision: 1 } as unknown as Plan;
  const revise: RevisePending = { plan, lines: chatPendingLines(plan), count: 1 };
  const onSong: TurnContext = { ...ctx, state: { hasSong: true, scoreReadable: true }, facts, draft: null, request: 'and jazz chords in bars 47-50', revise };
  const edit = (drop: number[], ops: unknown[]) => ({ content: JSON.stringify({ action: 'edit', message: 'ok', assumptions: [], drop, ops }), promptTokens: 1 });

  it('the edit schema gains drop, the PENDING PLAN is in the prompt, and the merge comes back as the card\'s since', async () => {
    const ask = scripted(edit([], [HARM]));
    const d = await decideReply(onSong, { ask });
    expect(d).toMatchObject({ ok: true, attempts: 1, reply: { action: 'edit', ops: [TEMPO, HARM] } });
    expect(d.since).toEqual({ planId: 'p1', marks: [{ mark: 'SAME', was: TEMPO }, { mark: 'NEW', was: null }], removed: [] });
    expect(JSON.stringify(ask.mock.calls[0][1])).toContain('"drop"');
    expect((ask.mock.calls[0][0] as PromptMessage[])[1].content).toContain('PENDING PLAN (plan 1, made for: "faster"):\nop 1 SET_TEMPO {"bpm":88}: applied');
  });

  it('an empty revise is retried with NOTHING_REVISED; a say leaves no since (the card stays pending)', async () => {
    const ask = scripted(edit([], []), edit([1], [{ op: 'SET_TEMPO', bpm: 80 }]));
    const d = await decideReply(onSong, { ask });
    expect(d.ok && d.refusals).toEqual([[NOTHING_REVISED]]);
    expect(d.since?.marks.map((m) => m.mark)).toEqual(['NEW']);
    expect(d.since?.removed).toEqual([TEMPO]);
    const said = await decideReply(onSong, { ask: scripted(sayReply('It is in D minor.')) });
    expect(said).toMatchObject({ ok: true, reply: { action: 'say' }, since: null });
  });

  it('no pending plan: no drop in the schema and no since', async () => {
    const ask = scripted(edit([], [TEMPO]));
    const d = await decideReply({ ...onSong, revise: null }, { ask });
    expect(JSON.stringify(ask.mock.calls[0][1])).not.toContain('"drop"');
    expect(d.since).toBeNull();
  });
});
