import { describe, it, expect, vi } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
import { RECIPE } from '../../../test-fakes/chatScripts.js';
import { checkReply, type CheckContext } from './replyCheck.js';
import { ACTIONS } from './turnActions.js';
import type { ApplyResult, ScoreFacts } from '../score/planTypes.js';

const facts = contract('read-ok').response.body.facts as ScoreFacts;
const draft: CheckContext = { allowed: ACTIONS, shapeOnly: ['scalpel', 'analyze', 'edit'], facts: null, phraseBars: 4, request: 'a song' };
const song: CheckContext = { allowed: ACTIONS, shapeOnly: ['scalpel', 'analyze'], facts, phraseBars: 4, request: 'make it slower' };
const recipe = (over: Record<string, unknown> = {}) => ({ action: 'recipe', message: 'ok', assumptions: [], recipe: { ...RECIPE, ...over } });
const reasons = async (json: unknown, ctx = draft, deps = {}) => {
  const r = await checkReply(json, ctx, deps);
  return r.ok ? [] : r.reasons;
};

describe('reply check', () => {
  it('C3: keeps a valid reference_use, drops an unknown one (D-128)', async () => {
    const kept = await checkReply(recipe({ reference_use: 'cover' }), draft, {});
    expect(kept.ok && kept.reply.action === 'recipe' && kept.reply.recipe.reference_use).toBe('cover');
    const dropped = await checkReply(recipe({ reference_use: 'steal' }), draft, {});
    expect(dropped.ok && dropped.reply.action === 'recipe' && 'reference_use' in dropped.reply.recipe).toBe(false);
  });

  it('passes a valid recipe and keeps only the known fields', async () => {
    const r = await checkReply({ ...recipe(), extra: 1 }, draft, {});
    expect(r).toEqual({ ok: true, reply: { action: 'recipe', message: 'ok', assumptions: [], recipe: RECIPE }, applied: null });
  });

  it('refuses an action outside the set, or outside what this turn allows', async () => {
    expect(await reasons({ action: 'dance', message: 'x' })).toEqual(['action "dance" is not one of ask, recipe, edit, scalpel, analyze, say']);
    expect(await reasons({ action: 'edit', message: 'x', assumptions: [], ops: [] }, { ...draft, allowed: ['ask', 'say'] }))
      .toEqual(['action "edit" is not one of ask, say']);
    expect(await reasons('hello')).toEqual(['the reply is not a JSON object {"action": ...}']);
  });

  it('holds a recipe to recipeRules (a bad key is a retry reason)', async () => {
    expect(await reasons(recipe({ key: 'Aminor' }))).toEqual(['key "Aminor" is not one of the 30 key names (C, Am, F#m ...)']);
    expect(await reasons(recipe({ lyrics: [{ tag: 'Verse', lines: ['[Chorus] la'] }] }))).toContain('section 1 (Verse) has 1 lines; write 4-8');
  });

  it('checks shape only for an action this version answers as a say', async () => {
    expect(await reasons({ action: 'edit', message: 'x', assumptions: [], ops: [{ op: 'REHARMONIZE', from_bar: 999 }] })).toEqual([]);
    expect(await reasons({ action: 'scalpel', message: 'x', kind: 'paint', target: 'a', details: '' })).toEqual(['scalpel kind "paint" is not one of repaint, add_layer, split, export']);
    expect(await reasons({ action: 'ask', message: 'x', choices: ['a'] })).toEqual(['ask needs 2-4 choices']);
  });

  it('an edit on a song: bar 999 is refused by the reused checkOps', async () => {
    const out = await reasons({ action: 'edit', message: 'x', assumptions: [], ops: [{ op: 'REHARMONIZE', from_bar: 999, to_bar: 999, chords: [{ bar: 999, beat: 1, root: 'G', quality: 'm7' }] }] }, song);
    expect(out[0]).toBe('op 1 (REHARMONIZE): from_bar 999 is outside the score (bars 1-65)');
  });

  it('an edit on a song is applied and held to the limits: a 458 s plan comes back with the reason', async () => {
    const applied = { ...contract('apply-set-tempo').response.body, seconds: 458 } as unknown as ApplyResult;
    const apply = vi.fn(async () => applied);
    const out = await reasons({ action: 'edit', message: 'x', assumptions: [], ops: [{ op: 'SET_TEMPO', bpm: 50 }] }, song, { apply });
    expect(apply).toHaveBeenCalledOnce();
    expect(out.join(' ')).toMatch(/458/);
  });

  it('guard: an edit naming a section the song lacks is sent back, even when this version only redirects edits', async () => {
    const edit = { action: 'edit', message: 'x', assumptions: [], ops: [{ op: 'REPEAT', section: 4, label: 'outro' }] };
    for (const ctx of [song, { ...song, shapeOnly: [...song.shapeOnly, 'edit' as const] }]) {
      expect((await reasons(edit, { ...ctx, request: 'repeat the bridge' }))[0]).toMatch(/^the request names the bridge, but this song has no bridge/);
    }
  });

  it('guard: a say naming another key than the HEADER\'s is sent back; without a song it is not judged', async () => {
    expect(await reasons({ action: 'say', message: 'It is in G minor.' }, song)).toEqual([
      'you named the key G minor, but the HEADER says K:Dm (D minor) for the active version: quote the HEADER',
    ]);
    expect(await reasons({ action: 'say', message: 'It is in D minor.' }, song)).toEqual([]);
    expect(await reasons({ action: 'say', message: 'It is in G minor.' }, draft)).toEqual([]);
  });

  it('guard: after an apply, a rewritten block in another language is sent back', async () => {
    const applied = contract('apply-rewrite-lyrics').response.body as unknown as ApplyResult;
    const edit = { action: 'edit', message: 'x', assumptions: [], ops: [{ op: 'REWRITE_LYRICS', block: 2, tag: '[Chorus]', occurrence: 1, lines: ['a'] }] };
    const language = vi.fn(async (t: string) => (t.startsWith('chorus 5') ? 'de' : 'en'));
    const out = await reasons(edit, song, { apply: async () => applied, language });
    expect(out).toEqual([`op 1 (REWRITE_LYRICS): the new lines read as 'en' but the block they replace reads as 'de': write them in the song's own language ('de')`]);
  });

  it('F-065 edge: REWRITE LYRICS on an instrumental is refused with the reason (scoreLimits.wordsRefusal, D-144)', async () => {
    const applied = contract('apply-rewrite-lyrics').response.body as unknown as ApplyResult;
    const instrumental = { ...facts, lyric_blocks: facts.lyric_blocks.map((b) => ({ ...b, lines: 0 })) };
    const edit = { action: 'edit', message: 'x', assumptions: [], ops: [{ op: 'REWRITE_LYRICS', block: 2, tag: '[Chorus]', occurrence: 1, lines: ['a'] }] };
    const out = await reasons(edit, { ...song, facts: instrumental }, { apply: async () => applied });
    expect(out).toContain('this song is instrumental: there are no words to rewrite');
  });

  it('C1: an edit outside the mark is retried before any apply; inside it passes (D-176)', async () => {
    const apply = vi.fn(async () => contract('apply-reharmonize').response.body as ApplyResult);
    const reharm = (from: number) => ({ action: 'edit', message: 'jazz', assumptions: [], ops: [
      { op: 'REHARMONIZE', from_bar: from, to_bar: from + 1, chords: [{ bar: from, beat: 1, root: 'C', quality: 'maj7' }] }] });
    const marked = { ...song, markRange: [47, 58] as [number, number] };
    expect(await reasons(reharm(11), marked, { apply })).toEqual(['op 1 (REHARMONIZE): bar 11 is outside the mark (bars 47-58); plan only inside it']);
    expect(apply).not.toHaveBeenCalled();
    expect((await checkReply(reharm(47), marked, {})).ok).toBe(true);
  });

  it('C1 live B2: under a mark, a whole-song op is retried unless the person asked for the whole song', async () => {
    const jazzier = { action: 'edit', message: 'jazz', assumptions: [], ops: [{ op: 'EDIT_STYLE', style: 'jazz' },
      { op: 'REHARMONIZE', from_bar: 47, to_bar: 48, chords: [{ bar: 47, beat: 1, root: 'C', quality: 'maj7' }] }] };
    const marked = { ...song, request: 'make this jazzier', markRange: [47, 58] as [number, number] };
    expect((await reasons(jazzier, marked, {}))[0]).toContain('a whole-song change needs the person to ask for it');
    expect((await checkReply(jazzier, { ...marked, markWhole: true }, {})).ok).toBe(true);
  });
});
