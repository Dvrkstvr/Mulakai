/** F-023 #3: APPLY & RENDER's re-check, in order: eligibility, plan alive, base version unchanged,
 * no edit queued after the plan, something to render with, `/api/ps` empty. Pure table. Each refusal
 * names its kind: `plan` (the plan is out of date) or `gpu` (the planner may hold the GPU, D-054). */
import { describe, it, expect } from 'vitest';
import { renderRefusal, type RenderFacts } from './scoreRenderCheck.js';
import { CHANGED_SINCE_PLAN } from './scoreEligibility.js';
import { NO_SEED, PLAN_EXPIRED, editQueued, plannerLoaded, plannerUnconfirmed } from './scoreLimits.js';
type Plan = import('./planTypes.js').Plan;
type ScoreSource = import('./scoreSource.js').ScoreSource;

const source = { songId: 's1', fingerprint: 'L|v1|v1', seed: 831, lyrics: '[Verse]\nla\n' } as ScoreSource;
const plan = { id: 'p1', songId: 's1', fingerprint: 'L|v1|v1' } as Plan;
const ok: RenderFacts = { songId: 's1', eligibility: { state: 'eligible' }, plan, source, pendingEdit: null, loaded: [] };

describe('renderRefusal', () => {
  it('lets an unchanged, eligible song with a live plan and an empty /api/ps through', () => {
    expect(renderRefusal(ok)).toBeNull();
  });

  it.each<[string, Partial<RenderFacts>, string, 'plan' | 'gpu']>([
    ['eligibility lost (a repaint version landed)', { eligibility: { state: 'ineligible', reason: 'This song has a repaint version, so score editing ended when it was made.' } },
      'This song has a repaint version, so score editing ended when it was made.', 'plan'],
    ['score checker offline', { eligibility: { state: 'offline', reason: 'Score checker unreachable: x. Start yue-server, then RECHECK.' } },
      'Score checker unreachable: x. Start yue-server, then RECHECK.', 'plan'],
    ['song gone', { eligibility: { state: 'hidden' }, source: null }, 'SCORE is not available for this song', 'plan'],
    ['plan expired (restart)', { plan: undefined }, PLAN_EXPIRED, 'plan'],
    ["another song's plan", { plan: { ...plan, songId: 's2' } }, PLAN_EXPIRED, 'plan'],
    ['base version changed', { source: { ...source, fingerprint: 'L|v1,v2|v2' } }, CHANGED_SINCE_PLAN, 'plan'],
    ['an edit queued after the plan', { pendingEdit: 'repaint 1:32–2:07' }, editQueued('repaint 1:32–2:07'), 'plan'],
    ['no stored seed', { source: { ...source, seed: null } }, NO_SEED, 'plan'],
    ['planner still loaded', { loaded: [{ name: 'qwen3:14b', contextLength: 16384 }] }, plannerLoaded(['qwen3:14b']), 'gpu'],
    ['ps unreadable', { loaded: { error: 'planner http://x/api/ps -> HTTP 500' } }, plannerUnconfirmed('planner http://x/api/ps -> HTTP 500'), 'gpu'],
  ])('refuses: %s', (_name, over, reason, kind) => {
    expect(renderRefusal({ ...ok, ...over })).toEqual({ reason, kind });
  });

  it('names the first failing check only, in the documented order', () => {
    expect(renderRefusal({ ...ok, plan: undefined, loaded: [{ name: 'qwen3:14b', contextLength: null }] })).toMatchObject({ reason: PLAN_EXPIRED });
    expect(renderRefusal({ ...ok, eligibility: { state: 'ineligible', reason: 'r' }, plan: undefined })).toMatchObject({ reason: 'r' });
    expect(renderRefusal({ ...ok, source: { ...source, fingerprint: 'x' }, pendingEdit: 'repaint' })).toMatchObject({ reason: CHANGED_SINCE_PLAN });
  });

  it('says how to free the GPU', () => {
    expect(plannerLoaded(['qwen3:14b'])).toContain('ollama stop qwen3:14b');
  });
});
