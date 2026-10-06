import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
import { decideReply, type TurnContext } from './turnCall.js';
import { checkReply } from './replyCheck.js';
import { dispatchReply, REDIRECT } from './turnDispatch.js';
import { ACTIONS } from './turnActions.js';
import type { ScoreFacts } from '../score/planTypes.js';
import type { Draft, TurnReply } from './chatTypes.js';

/** Real qwen3:14b replies recorded by SP-5 on the v3.1 prompt (test-fakes/data/sp5-replies.json), every attempt verbatim. */
interface Recorded { turn: string; request: string; song_key: string | null; attempts: Array<{ content: string; reasons: string[] }> }
const data = JSON.parse(readFileSync(new URL('../../../test-fakes/data/sp5-replies.json', import.meta.url), 'utf8')) as { turns: Recorded[] };
const turn = (id: string) => data.turns.find((t) => t.turn === id)!;

// read-ok has the sections of SP-5's "Romantica" (intro, verse, chorus, outro); the HEADER key is set to the recorded song's.
const readOk = contract('read-ok').response.body.facts as ScoreFacts;
const factsFor = (t: Recorded): ScoreFacts | null => (t.song_key ? { ...readOk, header: { ...readOk.header, key: t.song_key } } : null);
const draft: Draft = { draft_v: 1, rev: 0, fields: {}, touched: {} };

async function replay(t: Recorded) {
  const facts = factsFor(t);
  const ctx: TurnContext = {
    state: { hasSong: Boolean(facts), scoreReadable: Boolean(facts) }, block: [facts ? 'SONG: "Romantica"' : 'SONG: none yet'],
    facts, request: t.request, pending: false, draft: facts ? null : {}, history: [],
  };
  const replies = t.attempts.map((a) => a.content);
  const sent: string[] = [];
  const decision = await decideReply(ctx, {
    ask: async (msgs) => { sent.push(msgs.at(-1)!.content); return { content: replies.shift() ?? '', promptTokens: 3000 }; },
  });
  return { decision, sent, facts };
}

const dispatch = (reply: TurnReply, hasSong: boolean) => dispatchReply({ reply, hasSong, draft, sentRev: 0, scoreReason: null });

describe('SP-5 recorded replies replayed through decideReply / replyCheck / turnDispatch', () => {
  it('RC05: a German recipe passes on the first try and becomes a card built from its fields', async () => {
    const { decision } = await replay(turn('RC05.t1'));
    expect(decision).toMatchObject({ ok: true, attempts: 1 });
    if (!decision.ok || decision.reply.action !== 'recipe') throw new Error('not a recipe');
    const recorded = JSON.parse(turn('RC05.t1').attempts[0].content);
    const out = dispatch(decision.reply, false);
    expect(out.kind).toBe('recipe');
    if (out.kind !== 'recipe') return;
    expect(out.body.recipe).toEqual(recorded.recipe);
    expect(out.body.recipe).toMatchObject({ title: 'Abschied', language: 'de', key: 'A' });
    expect(out.draft.fields).toMatchObject({ title: 'Abschied', language: 'de', bpm: 60, timeSignature: '4/4' });
    expect(out.body.recipe.lyrics[0].lines[0]).toBe('Der Tag ist still, das Licht so schwach,');
  });

  it('AK02: a bare "yes, do that" with nothing pending is an ask with choices', async () => {
    const { decision } = await replay(turn('AK02.t1'));
    if (!decision.ok) throw new Error('rejected');
    expect(dispatch(decision.reply, false)).toMatchObject({ kind: 'ask', body: { choices: ['A romantic ballad', 'An upbeat pop song', 'A folk song', 'A jazz piece'] } });
  });

  it('MT03.t3: the say naming the old key is sent back with the spike\'s reason, the second try is kept', async () => {
    const t = turn('MT03.t3');
    const { decision, sent } = await replay(t);
    expect(decision).toMatchObject({ ok: true, attempts: 2 });
    expect(sent[1]).toContain(`Your reply was rejected:\n- ${t.attempts[0].reasons[0]}\n`);
    if (!decision.ok) return;
    expect(dispatch(decision.reply, true)).toEqual({ kind: 'say', text: 'The song is now in the key of Fm (F minor), as stated in the HEADER.', body: null });
  });

  it('ED09: an edit of the bridge the song lacks is sent back with the spike\'s reason; the say that follows is kept', async () => {
    const t = turn('ED09.t1');
    const { decision, sent } = await replay(t);
    expect(decision).toMatchObject({ ok: true, attempts: 2, reply: { action: 'say' } });
    expect(sent[1]).toContain(`- ${t.attempts[0].reasons[0]}\n`);
  });

  it('ED03: a SET_TEMPO edit passes checkOps; this version answers it by pointing to SCORE', async () => {
    const t = turn('ED03.t1');
    const { decision, facts } = await replay(t);
    if (!decision.ok) throw new Error('rejected');
    expect(decision.reply).toMatchObject({ action: 'edit', ops: [{ op: 'SET_TEMPO', bpm: 85 }] });
    const full = await checkReply(JSON.parse(t.attempts[0].content), { allowed: ACTIONS, shapeOnly: [], facts, phraseBars: 4, request: t.request }, {});
    expect(full.ok).toBe(true);
    expect(dispatch(decision.reply, true)).toEqual({ kind: 'say', text: REDIRECT.edit, body: null });
  });
});
