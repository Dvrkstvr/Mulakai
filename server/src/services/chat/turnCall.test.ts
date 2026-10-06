import { describe, it, expect, vi } from 'vitest';
import { RECIPE, badKeyRecipe, notJson, outOfSet, recipeReply, sayReply } from '../../../test-fakes/chatScripts.js';
import { recipeFields } from './draftModel.js';
import { MAX_TOKENS, decideReply, ladderRung, type TurnContext } from './turnCall.js';
import { turnAttempts } from './turnAttempts.js';
import type { ChatScript } from '../../../test-fakes/fakeOllama.js';

const ctx: TurnContext = { state: { hasSong: false, scoreReadable: false }, block: ['SONG: none yet'], facts: null, request: 'a sad song', pending: false, draft: {}, history: [] };
const scripted = (...replies: ChatScript[]) => {
  const ask = vi.fn(async (_m: unknown, _s?: unknown, _o?: { maxTokens: number }) => {
    const r = replies.length > 1 ? replies.shift()! : replies[0];
    return { content: r.content ?? '', promptTokens: r.promptTokens ?? null };
  });
  return ask;
};

describe('decideReply (rung 0: one call, the full schema)', () => {
  it('a valid recipe on the first try is one call', async () => {
    const ask = scripted(recipeReply());
    const d = await decideReply(ctx, { ask });
    expect(d).toMatchObject({ ok: true, attempts: 1, calls: 1, promptTokens: [2000] });
    expect(ask.mock.calls[0][1]).toHaveProperty('anyOf');
  });

  it('feeds the reasons back and reports progress "attempt n of 3 · reason"', async () => {
    const ask = scripted(notJson(), badKeyRecipe(), recipeReply());
    const progress: string[] = [];
    const d = await decideReply(ctx, { ask, onAttempt: (n, r) => progress.push(`${n}${r ? ` · ${r}` : ''}`) });
    expect(d).toMatchObject({ ok: true, attempts: 3, calls: 3 });
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
    expect(MAX_TOKENS).toEqual({ edit: 4000, other: 2000 });
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
    expect(ask.mock.calls[1][0][0].content).not.toContain('reference_use');
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
});
