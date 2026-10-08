/** LD-2 (F-095, D-234, D-252): rung 3 always on for recipes. Code decides keep vs write; a write is a lyrics call on the
 * language's model (2 calls), a keep is none (1 call); lyrics that fail their checks fail the turn. */
import { describe, it, expect, vi } from 'vitest';
import { RECIPE, autoLyrics, lyricsReply, recipeReply } from '../../../test-fakes/chatScripts.js';
import type { ChatScript } from '../../../test-fakes/fakeOllama.js';
import { decideReply, MAX_TOKENS, type CallDeps, type TurnContext } from './turnCall.js';
import { lyricsModelFor } from './lyricsModels.js';

const GEMMA = 'gemma4:26b-a4b-it-q4_K_M';
const ctx: TurnContext = { state: { hasSong: false, scoreReadable: false }, block: ['SONG: none yet'], facts: null, request: 'a slow Spanish ballad about the sea', pending: false, draft: {}, history: [] };
type Msgs = Array<{ role: string; content: string }>;

/** The recipe calls answer from `turns`, a lyrics call (lyricsPrompt's system prompt) from `lyrics`, else autoLyrics. */
function scripted(turns: ChatScript[], lyrics: ChatScript[] = []) {
  return vi.fn(async (msgs: Msgs, _schema: Record<string, unknown>, _o: { maxTokens: number; model?: string }) => {
    const isLyrics = msgs[0].content.startsWith('You write song lyrics');
    const q = isLyrics ? lyrics : turns;
    const r = (q.length > 1 ? q.shift() : q[0]) ?? autoLyrics(msgs);
    return { content: r.content ?? '', promptTokens: r.promptTokens ?? null };
  });
}
const modelFor = (lang: string) => lyricsModelFor(lang, {}, 'qwen3:14b');
const keepDraft = { ...RECIPE, timeSignature: '4/4', lyrics: RECIPE.lyrics };

describe('decideReply: rung 3, lyrics as their own call (LD-2)', () => {
  it('a Spanish recipe: 2 calls on the planner model, the card carries the lyrics call\'s lines', async () => {
    const ask = scripted([recipeReply()], [lyricsReply()]);
    const d = await decideReply(ctx, { ask, lyricsModel: modelFor });
    expect(d).toMatchObject({ ok: true, calls: 2, lyrics: { mode: 'write', attempts: 1, model: 'qwen3:14b' } });
    expect(d.ok && d.reply).toMatchObject({ action: 'recipe', recipe: RECIPE });
    expect(ask.mock.calls[0][2]).toEqual({ maxTokens: MAX_TOKENS.other }); // no edit on the draft thread (D-251)
    expect(ask.mock.calls[1][2]).toEqual({ maxTokens: MAX_TOKENS.lyrics, model: 'qwen3:14b' });
    expect(ask.mock.calls[1][0][0].content).toContain('Write ONLY in Spanish');
    expect(ask.mock.calls[1][1]).toMatchObject({ properties: { sections: { minItems: 5, maxItems: 5 } } });
  });

  it('a German recipe: the lyrics call runs on gemma4 (D-237), in German', async () => {
    const ask = scripted([recipeReply({ language: 'de', title: 'Abschied', style: 'German ballad, piano' })]);
    const progress: string[] = [];
    const d = await decideReply({ ...ctx, request: 'ein trauriges Lied über Abschied' }, { ask, lyricsModel: modelFor, onLyrics: (m, n) => progress.push(`${m} ${n}`) });
    expect(d).toMatchObject({ ok: true, calls: 2, lyrics: { mode: 'write', model: GEMMA } });
    expect(ask.mock.calls.map((c) => c[2].model)).toEqual([undefined, GEMMA]);
    expect(progress).toEqual([`${GEMMA} 1`]);
    expect(d.ok && d.reply.action === 'recipe' && d.reply.recipe.lyrics[0].lines[0]).toBe('Der Tag ist still, das Licht so schwach');
  });

  it('a follow-up not about the words keeps the draft\'s lyrics in one call, whatever the planner thinks (D-252, live phrasings)', async () => {
    for (const request of ['mach es etwas schneller', 'etwas schneller bitte, Text unverändert', 'make it faster', 'más lento']) {
      const ask = scripted([recipeReply({ bpm: 96 })]);
      const d = await decideReply({ ...ctx, request, pending: true, draft: keepDraft }, { ask, lyricsModel: modelFor });
      expect(d, request).toMatchObject({ ok: true, calls: 1, lyrics: { mode: 'keep', attempts: 0 } });
      expect(d.ok && d.reply.action === 'recipe' && d.reply.recipe).toMatchObject({ bpm: 96, lyrics: RECIPE.lyrics });
    }
  });

  it('F-095 live: a looped structure (Outro x7) costs a planner retry, not a lyrics call; the retry keeps (D-255)', async () => {
    const looped = [...RECIPE.structure, ...Array(6).fill('Outro')];
    const ask = scripted([recipeReply({ bpm: 96, structure: looped }), recipeReply({ bpm: 96 })]);
    const d = await decideReply({ ...ctx, request: 'mach es etwas schneller', pending: true, draft: keepDraft }, { ask, lyricsModel: modelFor });
    expect(d).toMatchObject({ ok: true, attempts: 2, calls: 2, lyrics: { mode: 'keep', attempts: 0 } });
    expect(ask.mock.calls.every((c) => !c[0][0].content.startsWith('You write song lyrics'))).toBe(true);
    expect(ask.mock.calls[1][0].at(-1)!.content).toContain('the structure repeats Outro 7 times at the end: an Outro appears once, last');
    expect(d.ok && d.reply.action === 'recipe' && d.reply.recipe).toMatchObject({ bpm: 96, structure: RECIPE.structure, lyrics: RECIPE.lyrics });
  });

  it('a follow-up about the words writes them anew: 2 calls', async () => {
    for (const request of ['schreib den Refrain neu', 'andere Strophen bitte', 'rewrite the chorus', 'cambia la letra']) {
      const ask = scripted([recipeReply()]);
      const d = await decideReply({ ...ctx, request, pending: true, draft: keepDraft }, { ask, lyricsModel: modelFor });
      expect(d, request).toMatchObject({ ok: true, calls: 2, lyrics: { mode: 'write', attempts: 1 } });
    }
  });

  it('a recipe in another language than the draft\'s writes, even for "make it faster"', async () => {
    const ask = scripted([recipeReply({ language: 'en', title: 'Light on the sea', style: 'slow ballad, nylon guitar' })]);
    const d = await decideReply({ ...ctx, request: 'make it faster', pending: true, draft: keepDraft }, { ask, lyricsModel: modelFor });
    expect(d).toMatchObject({ ok: true, calls: 2, lyrics: { mode: 'write' } });
  });

  it('no lyrics, or lyrics that no longer follow the structure, write', async () => {
    for (const draft of [{}, { ...keepDraft, lyrics: [] }, keepDraft]) {
      const ask = scripted([recipeReply({ structure: [...RECIPE.structure.slice(0, 5), 'Bridge', 'Chorus', 'Outro'] })]);
      const d = await decideReply({ ...ctx, request: 'make it faster', pending: true, draft }, { ask, lyricsModel: modelFor });
      expect(d).toMatchObject({ ok: true, calls: 2, lyrics: { mode: 'write' } });
      expect(d.ok && d.reply.action === 'recipe' && d.reply.recipe.lyrics.map((s) => s.tag)).toEqual(['Verse', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Chorus', 'Outro']);
    }
  });

  it('a lyric singing "Mulakai" is refused and retried with the reason (D-236)', async () => {
    const leak = RECIPE.lyrics.map((s, i) => (i === 4 ? { ...s, lines: [...s.lines.slice(0, 3), 'Mulakai, luz sobre el mar'] } : s));
    const ask = scripted([recipeReply()], [lyricsReply(leak), lyricsReply()]);
    const d = await decideReply(ctx, { ask, lyricsModel: modelFor });
    expect(d).toMatchObject({ ok: true, calls: 3, lyrics: { attempts: 2 } });
    expect(ask.mock.calls[2][0].at(-1)!.content).toContain("- line 4 of section 5 contains 'Mulakai'");
  });

  it('lyrics failing three times fail the turn with the lyrics step\'s reasons (F-049: nothing written)', async () => {
    const short = RECIPE.lyrics.map((s) => ({ ...s, lines: ['ay', 'ay', 'ay', 'ay'] }));
    const ask = scripted([recipeReply()], [lyricsReply(short)]);
    const d = await decideReply(ctx, { ask, lyricsModel: modelFor });
    expect(d).toMatchObject({ ok: false, attempts: 3, calls: 4 });
    expect(!d.ok && d.reasons[0]).toMatch(/under 6 characters/);
  });

  it('a recipe answered as a say (a song thread, D-112) asks no lyrics; a say or an ask never does', async () => {
    const ask = scripted([recipeReply()]);
    const d = await decideReply({ ...ctx, state: { hasSong: true, scoreReadable: true }, draft: null }, { ask, lyricsModel: modelFor } as CallDeps);
    expect(d).toMatchObject({ ok: true, calls: 1 });
    expect(d.lyrics).toBeUndefined();
  });

  it('a thrown lyrics call (cancel, HTTP) ends the turn at once', async () => {
    let n = 0;
    const ask = vi.fn(async () => { n += 1; if (n === 2) throw new Error('Aborted'); return { content: recipeReply().content!, promptTokens: 2000 }; });
    await expect(decideReply(ctx, { ask })).rejects.toThrow('Aborted');
    expect(ask).toHaveBeenCalledTimes(2);
  });
});
