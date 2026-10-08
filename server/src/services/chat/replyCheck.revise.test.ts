/** A revise never loses an op silently (architecture.md "Test strategy (C2)" #1, Q-050): an edit reply on a turn
 * with a pending plan is read as `{drop, ops}`, merged by mergeRevise and the merged plan applied once. Every
 * accepted case: the applied ops are the merged ops, and the pending ops are the kept ones plus REMOVED. */
import { describe, it, expect, vi } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
import { checkReply, type CheckContext, type Checked } from './replyCheck.js';
import { ACTIONS } from './turnActions.js';
import { NOTHING_REVISED } from '../score/planRevise.js';
import { LEGEND_HEAD } from '../score/reviseReply.js';
import type { ApplyResult, Op, ScoreFacts } from '../score/planTypes.js';

const facts = contract('read-ok').response.body.facts as ScoreFacts;
const COMPOUND = contract('apply-compound').request.body.ops as Op[];
const [TEMPO, HARM, JAZZ] = COMPOUND; // SET_TEMPO 88, REHARMONIZE 47-50, EDIT_STYLE
const STYLE: Op = { op: 'EDIT_STYLE', style: 'jazz trio' };
const UP: Op = { op: 'TRANSPOSE', semitones: -2 };
const ctx = (pending: Op[], over: Partial<CheckContext> = {}): CheckContext =>
  ({ allowed: ACTIONS, shapeOnly: ['scalpel', 'analyze'], facts, phraseBars: 4, request: 'and jazz chords', pending, ...over });
const edit = (drop: unknown, ops: unknown) => ({ action: 'edit', message: 'ok', assumptions: [], drop, ops });
const ok = (applied: Partial<ApplyResult> = {}) => vi.fn(async (ops: Op[]) => ({ ...contract('apply-compound').response.body, ...applied, ops }) as unknown as ApplyResult);

/** The accepted reply's ops are the merged ones, the apply saw them, and no pending op is lost. */
function accepted(r: Checked, pending: Op[], apply?: ReturnType<typeof ok>) {
  if (!r.ok || r.reply.action !== 'edit') throw new Error(`refused: ${r.ok ? r.reply.action : r.reasons.join('; ')}`);
  const { ops } = r.reply;
  if (apply) expect(apply).toHaveBeenCalledWith(ops);
  const kept = r.revised!.marks.flatMap((m) => (m.was ? [m.was] : []));
  expect([...kept, ...r.revised!.removed].map((o) => JSON.stringify(o)).sort()).toEqual(pending.map((o) => JSON.stringify(o)).sort());
  return { ops, marks: r.revised!.marks.map((m) => m.mark), removed: r.revised!.removed };
}
const reasons = async (json: unknown, c: CheckContext) => { const r = await checkReply(json, c, {}); return r.ok ? [] : r.reasons; };

describe('a revise turn\'s edit check (F-058, D-227)', () => {
  it('additive ("and jazz chords in bars 47-50, as a jazz trio"): drop [], two NEW; the merged plan is apply-compound\'s, applied once', async () => {
    const apply = ok();
    const r = accepted(await checkReply(edit([], [HARM, JAZZ]), ctx([TEMPO]), { apply }), [TEMPO], apply);
    expect(r).toEqual({ ops: COMPOUND, marks: ['SAME', 'NEW', 'NEW'], removed: [] });
    expect(apply).toHaveBeenCalledOnce();
  });

  it('a changed target ("slow it to 80 instead") is CHANGED with the old op as `was`', async () => {
    const slow: Op = { op: 'SET_TEMPO', bpm: 80 };
    const r = await checkReply(edit([], [slow]), ctx([TEMPO, HARM]), {});
    expect(accepted(r, [TEMPO, HARM])).toEqual({ ops: [slow, HARM], marks: ['CHANGED', 'SAME'], removed: [] });
    expect(r.ok && r.revised!.marks[0].was).toEqual(TEMPO);
  });

  it('a drop ("fewer chords": no chords after all) lists the dropped op under REMOVED', async () => {
    expect(accepted(await checkReply(edit([2], []), ctx([TEMPO, HARM]), {}), [TEMPO, HARM])).toEqual({ ops: [TEMPO], marks: ['SAME'], removed: [HARM] });
  });

  it('drop every pending op and return new ones: a replacement, all REMOVED + NEW, never silent', async () => {
    expect(accepted(await checkReply(edit([1, 2], [UP]), ctx([TEMPO, HARM]), {}), [TEMPO, HARM]))
      .toEqual({ ops: [UP], marks: ['NEW'], removed: [TEMPO, HARM] });
  });

  it('C2 live B2: a start over drops every pending op whatever the reply\'s drop says; the scrapped ops are REMOVED', async () => {
    const over = ctx([TEMPO, HARM], { request: 'scrap that, instead transpose it down a tone' });
    expect(accepted(await checkReply(edit([], [UP]), over, {}), [TEMPO, HARM])).toEqual({ ops: [UP], marks: ['NEW'], removed: [TEMPO, HARM] });
    expect(accepted(await checkReply(edit([1], [UP]), over, {}), [TEMPO, HARM])).toEqual({ ops: [UP], marks: ['NEW'], removed: [TEMPO, HARM] });
  });

  it('an echo of the pending plan is all SAME, not refused (D-076 e)', async () => {
    expect(accepted(await checkReply(edit([], [TEMPO, HARM]), ctx([TEMPO, HARM]), {}), [TEMPO, HARM]))
      .toEqual({ ops: [TEMPO, HARM], marks: ['SAME', 'SAME'], removed: [] });
  });

  it('an empty revise is retried with NOTHING_REVISED; dropping every op and adding none is retried too', async () => {
    expect(await reasons(edit([], []), ctx([TEMPO]))).toEqual([NOTHING_REVISED]);
    expect((await reasons(edit([1], []), ctx([TEMPO])))[0]).toMatch(/drops every op/);
  });

  it('a merge over 6 ops is a named refusal (MAX_OPS)', async () => {
    const pending: Op[] = [TEMPO, HARM, STYLE, UP, { op: 'REPEAT', section: 3, label: 'chorus' }, { op: 'CUT', section: 4, label: 'outro' }];
    expect(await reasons(edit([], [{ op: 'REPEAT', section: 2, label: 'verse' }]), ctx(pending)))
      .toEqual(['the revised plan has 7 ops; at most 6: drop pending ops or return fewer']);
  });

  it('outside input: a drop number out of range or twice, a missing drop or ops list', async () => {
    expect(await reasons(edit([3], []), ctx([TEMPO, HARM]))).toEqual(['drop 3 is not a pending op number (1-2)']);
    expect(await reasons(edit([1, 1], []), ctx([TEMPO, HARM]))).toEqual(['drop lists pending op 1 twice']);
    expect((await reasons(edit(undefined, [HARM]), ctx([TEMPO])))[0]).toMatch(/\{"drop":\[\.\.\.\],"ops":\[\.\.\.\]\}/);
    expect(await reasons({ action: 'edit', message: 'x', assumptions: [], drop: [] }, ctx([TEMPO]))).toEqual(['edit needs an ops list']);
  });

  it('under a mark only the returned ops are bounded (D-214): a kept op outside it stays SAME, a new one outside is retried', async () => {
    const marked = ctx([TEMPO, HARM], { markRange: [23, 30] });
    const inside: Op = { op: 'REHARMONIZE', from_bar: 23, to_bar: 24, chords: [{ bar: 23, beat: 1, root: 'C', quality: 'maj7' }] };
    expect(accepted(await checkReply(edit([], [inside]), marked, {}), [TEMPO, HARM]).marks).toEqual(['SAME', 'SAME', 'NEW']);
    const outside = await reasons(edit([], [{ ...inside, from_bar: 40, to_bar: 41, chords: [{ bar: 40, beat: 1, root: 'C', quality: 'maj7' }] }]), marked);
    expect(outside[0]).toMatch(/^op 1 \(REHARMONIZE\): bar 40 is outside the mark \(bars 23-30\)/);
  });

  it('a refused apply goes back with the merge legend first: yue-server numbers the merged ops', async () => {
    const refused = ok({ ok: false, verdicts: [{ index: 1, op: 'SET_TEMPO', ok: true, reason: null }, { index: 2, op: 'REHARMONIZE', ok: false, reason: 'bar 47 has no beat 5' }] });
    const out = await checkReply(edit([], [HARM]), ctx([TEMPO]), { apply: refused });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reasons[0]).toBe(`${LEGEND_HEAD} op 1 = pending op 1, op 2 = your op 1 (new).`);
    expect(out.reasons).toContain('op 2 (REHARMONIZE): bar 47 has no beat 5');
  });

  it('without a pending plan an edit is checked as before: no drop needed, no `revised`', async () => {
    const r = await checkReply({ action: 'edit', message: 'x', assumptions: [], ops: [TEMPO] }, ctx([], { pending: undefined }), {});
    expect(r.ok && r.revised).toBeUndefined();
    expect(r.ok && r.reply.action === 'edit' && r.reply.ops).toEqual([TEMPO]);
  });
});
