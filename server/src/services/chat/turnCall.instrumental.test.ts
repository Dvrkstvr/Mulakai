/** F-097 (D-260): an instrumental new song from chat. The planner's recipe says `vocals`; an instrumental asks no
 * lyrics call (1 call, no gemma4) and carries no lines, whatever the request's words say about the lyrics; the draft's
 * vocals hold on a follow-up that names neither the words nor the voice; asking for words back writes them (2 calls). */
import { describe, it, expect, vi } from 'vitest';
import { RECIPE, autoLyrics, recipeReply } from '../../../test-fakes/chatScripts.js';
import type { ChatScript } from '../../../test-fakes/fakeOllama.js';
import { decideReply, type TurnContext } from './turnCall.js';
import { lyricsModelFor } from './lyricsModels.js';
import { recipeFields } from './draftModel.js';
import { turnSchema } from './actionSchema.js';
import { chatRules } from './chatRules.js';
import { fieldLines } from './songState.js';

const GEMMA = 'gemma4:26b-a4b-it-q4_K_M';
type Msgs = Array<{ role: string; content: string }>;
function scripted(turns: ChatScript[]) {
  return vi.fn(async (msgs: Msgs, _schema: Record<string, unknown>, _o: { maxTokens: number; model?: string }) => {
    const r = msgs[0].content.startsWith('You write song lyrics') ? autoLyrics(msgs) : (turns.length > 1 ? turns.shift()! : turns[0]);
    return { content: r.content ?? '', promptTokens: r.promptTokens ?? null };
  });
}
const modelFor = (lang: string) => lyricsModelFor(lang, {}, 'qwen3:14b');
const DE = { language: 'de', title: 'Abschied', style: 'German ballad, piano' };
const germanDraft = { ...recipeFields({ ...RECIPE, ...DE }), vocals: 'sung' as const };
const instrumentalDraft = { ...germanDraft, lyrics: [], vocals: 'instrumental' as const };
const ctx = (request: string, draft = germanDraft): TurnContext =>
  ({ state: { hasSong: false, scoreReadable: false }, block: ['SONG: none yet'], facts: null, request, pending: true, draft, history: [] });

describe('decideReply: an instrumental recipe (F-097)', () => {
  it('"mach es instrumental" / "remove the lyrics" / "ohne Gesang" on a German draft with lyrics: 1 call, no gemma4, no lines', async () => {
    for (const request of ['mach es instrumental', 'remove the lyrics', 'ohne Gesang bitte', 'keine Lyrics', 'sin letra']) {
      const ask = scripted([recipeReply({ ...DE, vocals: 'instrumental' })]);
      const d = await decideReply(ctx(request), { ask, lyricsModel: modelFor });
      expect(d, request).toMatchObject({ ok: true, calls: 1, lyrics: { mode: 'instrumental', attempts: 0 } });
      expect(ask.mock.calls.map((c) => c[2].model)).not.toContain(GEMMA);
      expect(d.ok && d.reply.action === 'recipe' && d.reply.recipe).toMatchObject({ vocals: 'instrumental', lyrics: [] });
    }
  });

  it('a follow-up not about the voice stays instrumental in 1 call, even if the planner flips to sung', async () => {
    for (const vocals of ['instrumental', 'sung'] as const) {
      const ask = scripted([recipeReply({ ...DE, bpm: 96, vocals })]);
      const d = await decideReply(ctx('etwas schneller', instrumentalDraft), { ask, lyricsModel: modelFor });
      expect(d, vocals).toMatchObject({ ok: true, calls: 1, lyrics: { mode: 'instrumental' } });
      expect(d.ok && d.reply.action === 'recipe' && d.reply.recipe).toMatchObject({ bpm: 96, vocals: 'instrumental', lyrics: [] });
    }
  });

  it('"doch mit Text bitte" on an instrumental draft: sung, the lyrics call writes (2 calls)', async () => {
    const ask = scripted([recipeReply({ ...DE, vocals: 'sung' })]);
    const d = await decideReply(ctx('doch mit Text bitte', instrumentalDraft), { ask, lyricsModel: modelFor });
    expect(d).toMatchObject({ ok: true, calls: 2, lyrics: { mode: 'write', model: GEMMA } });
    expect(d.ok && d.reply.action === 'recipe' && d.reply.recipe.vocals).toBe('sung');
    expect(d.ok && d.reply.action === 'recipe' && d.reply.recipe.lyrics.length).toBe(5);
  });

  it('a first recipe takes the planner\'s vocals; one with no vocals field is sung', async () => {
    const first = await decideReply({ ...ctx('an instrumental lo-fi beat'), pending: false, draft: {} }, { ask: scripted([recipeReply({ vocals: 'instrumental' })]) });
    expect(first).toMatchObject({ ok: true, calls: 1, lyrics: { mode: 'instrumental' } });
    const old = await decideReply({ ...ctx('a ballad'), pending: false, draft: {} }, { ask: scripted([recipeReply()]) });
    expect(old).toMatchObject({ ok: true, calls: 2 });
    expect(old.ok && old.reply.action === 'recipe' && old.reply.recipe.vocals).toBe('sung');
  });
});

describe('the planner is told about vocals, briefly', () => {
  it('the recipe schema carries vocals: sung | instrumental', () => {
    const s = turnSchema({ facts: null, phraseBars: 4, allowed: ['recipe'] }) as { properties: { recipe: { properties: Record<string, unknown>; required: string[] } } };
    expect(s.properties.recipe.properties.vocals).toEqual({ enum: ['sung', 'instrumental'] });
    expect(s.properties.recipe.required).toContain('vocals');
  });

  it('the rules name the instrumental cue and the follow-up keep in one sentence; the PROPOSAL shows an instrumental', () => {
    const rules = chatRules(['recipe', 'say', 'ask']);
    expect(rules).toMatch(/vocals: "instrumental" when the person asks for no vocals, no lyrics, no singing or an instrumental/);
    expect(fieldLines(instrumentalDraft)).toContain('vocals: instrumental (no lyrics)');
    expect(fieldLines(germanDraft).join('\n')).not.toContain('vocals');
  });
});
