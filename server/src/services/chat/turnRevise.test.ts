import { describe, it, expect, afterEach } from 'vitest';
import { getPlan, resetPlans, setPlan } from '../score/planStore.js';
import { REVISE_LINES } from '../score/planRevise.js';
import type { Op, Plan } from '../score/planTypes.js';
import { propose, resetProposals } from './proposalStore.js';
import { CHAT_KEEP_LINE, CHAT_REVISE_LINE, chatPendingLines, pendingFor } from './turnRevise.js';

const TEMPO: Op = { op: 'SET_TEMPO', bpm: 88 };
const HARM: Op = { op: 'REHARMONIZE', from_bar: 47, to_bar: 50, chords: [47, 48, 49, 50].map((bar) => ({ bar, beat: 1, root: 'D', quality: 'm7' as const })) };
const plan = (over: Partial<Plan> = {}): Plan => ({
  id: 'p1', songId: 's1', baseVersionId: 'v1', fingerprint: 'f1', request: 'faster', ops: [TEMPO, HARM],
  verdicts: [{ index: 1, op: 'SET_TEMPO', ok: true, reason: null }, { index: 2, op: 'REHARMONIZE', ok: true, reason: null }],
  abc: '', style: '', checks: { bars: 65, seconds: 179, tokens: 1832, chordsPresent: true, changed: { abc: true, style: false } },
  attempts: 1, refusals: [], createdAt: 0, revision: 1, since: null, renderMode: { cot: 'full', reason: 'chords' }, ...over,
} as Plan);
const card = (planId: string, id = `c-${planId}`, threadId = 't1') =>
  propose({ id, threadId, messageId: `m-${id}`, createdAt: 0, kind: 'edit', planId });

afterEach(() => { resetPlans(); resetProposals(); });

describe('turnRevise.pendingFor (F-058, D-227)', () => {
  it('a live edit card whose plan is still the song\'s, on the song as read, is revised: its PENDING lines and op count', () => {
    setPlan(plan());
    card('p1');
    const p = pendingFor('t1', 's1', 'f1');
    expect(p).toMatchObject({ plan: { id: 'p1' }, count: 2 });
    expect(p!.lines[0]).toBe('PENDING PLAN (plan 1, made for: "faster"):');
    expect(p!.lines[1]).toBe('op 1 SET_TEMPO {"bpm":88}: applied');
    expect(p!.lines).toEqual(chatPendingLines(getPlan('s1')!));
  });

  it('no card, or another thread\'s card: no revise', () => {
    setPlan(plan());
    expect(pendingFor('t1', 's1', 'f1')).toBeNull();
    card('p1', 'c1', 't2');
    expect(pendingFor('t1', 's1', 'f1')).toBeNull();
  });

  it('a superseded card (a newer card on the thread) is not revised; the newer one is', () => {
    setPlan(plan());
    card('p1');
    setPlan(plan({ id: 'p2' }));
    card('p2');
    expect(pendingFor('t1', 's1', 'f1')?.plan.id).toBe('p2');
  });

  it('a dock PLAN that replaced the chat\'s plan: no revise (the card expired)', () => {
    setPlan(plan());
    card('p1');
    setPlan(plan({ id: 'dock' }));
    expect(pendingFor('t1', 's1', 'f1')).toBeNull();
  });

  it('the song changed since the card (fingerprint): no revise, a fresh plan', () => {
    setPlan(plan());
    card('p1');
    expect(pendingFor('t1', 's1', 'f2')).toBeNull();
  });

  it('the chat\'s lines replace the dock\'s reply lines: the reply is an edit action with drop, and the rule\'s "complete op list" is overridden', () => {
    const lines = chatPendingLines(plan());
    expect(lines).not.toContain(REVISE_LINES[0]);
    expect(lines.slice(-2)).toEqual([CHAT_REVISE_LINE, CHAT_KEEP_LINE]);
    expect(CHAT_REVISE_LINE).toMatch(/"drop"/);
    expect(CHAT_REVISE_LINE).toMatch(/not the complete op list/);
  });

  it('CP-C2: drop is only for what the request removes, and the block ends on an addition keeping every pending op', () => {
    expect(CHAT_REVISE_LINE).toContain('"drop" lists only pending ops the request asks to remove');
    expect(CHAT_REVISE_LINE).toContain('same target (');
    expect(CHAT_KEEP_LINE).toMatch(/^A request that adds .* keeps every pending op: drop \[\]/);
    expect(CHAT_KEEP_LINE).toMatch(/not as the pending plan would leave it\.$/);
    expect(chatPendingLines(plan()).at(-1)).toBe(CHAT_KEEP_LINE);
  });
});
