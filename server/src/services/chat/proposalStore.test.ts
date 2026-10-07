import { describe, it, expect, beforeEach } from 'vitest';
import { RECIPE } from '../../../test-fakes/chatScripts.js';
import { analyzeById, dropProposals, editById, liveAnalyze, liveEdit, liveProposal, proposalById, proposalLife, propose, resetProposals } from './proposalStore.js';
import { dropPlan, setPlan } from '../score/planStore.js';
import type { Plan } from '../score/planTypes.js';

const p = (id: string, threadId = 't1') => ({ id, threadId, messageId: `m-${id}`, createdAt: 0, kind: 'recipe' as const, recipe: RECIPE });
const a = (id: string, threadId = 't1') => ({ id, threadId, messageId: `m-${id}`, createdAt: 0, kind: 'analyze' as const, target: { referenceId: 'r1' } });

const e = (id: string, planId: string, threadId = 't1') => ({ id, threadId, messageId: `m-${id}`, createdAt: 0, kind: 'edit' as const, planId });

describe('proposal store', () => {
  beforeEach(resetProposals);

  it('a newer proposal supersedes the older in the same thread only', () => {
    propose(p('a'));
    propose(p('x', 't2'));
    propose(p('b'));
    expect(proposalLife('a')).toBe('superseded');
    expect(proposalLife('b')).toBe('live');
    expect(proposalLife('x')).toBe('live');
    expect(liveProposal('t1')?.id).toBe('b');
  });

  it('an unknown id (a restart) is expired: null', () => {
    expect(proposalLife('never')).toBeNull();
  });

  it('NEW CHAT drops the thread\'s proposals', () => {
    propose(p('a'));
    propose(p('x', 't2'));
    dropProposals('t1');
    expect(proposalLife('a')).toBeNull();
    expect(liveProposal('t1')).toBeUndefined();
    expect(proposalLife('x')).toBe('live');
  });

  it('C3: an analyze card has its own slot per thread, superseded only by the next analyze', () => {
    propose(p('recipe'));
    propose(a('read1'));
    expect(proposalLife('recipe')).toBe('live');
    expect(liveAnalyze('t1')?.id).toBe('read1');
    propose(a('read2'));
    expect(proposalLife('read1')).toBe('superseded');
    expect(proposalLife('read2')).toBe('live');
    expect(liveProposal('t1')?.id).toBe('recipe');
  });

  it('trap: an analyze id is never a recipe proposal (CREATE SONG with a READ card id is refused), and the reverse', () => {
    propose(a('read1'));
    propose(p('recipe'));
    expect(proposalById('read1')).toBeUndefined();
    expect(analyzeById('read1')?.target).toEqual({ referenceId: 'r1' });
    expect(analyzeById('recipe')).toBeUndefined();
    dropProposals('t1');
    expect(proposalLife('read1')).toBeNull();
    expect(liveAnalyze('t1')).toBeUndefined();
  });

  it('CB-2: an edit card is live while its planStore plan is; the next edit card supersedes it (REPLACED, F-046 #3)', () => {
    setPlan({ id: 'plan1', songId: 's1' } as Plan);
    propose(p('recipe'));
    propose(e('edit1', 'plan1'));
    expect(proposalLife('edit1')).toBe('live');
    expect(editById('edit1')?.planId).toBe('plan1');
    expect(proposalById('edit1')).toBeUndefined();
    setPlan({ id: 'plan2', songId: 's1' } as Plan);
    propose(e('edit2', 'plan2'));
    expect(proposalLife('edit1')).toBe('superseded');
    expect(proposalLife('edit2')).toBe('live');
    expect(proposalLife('recipe')).toBe('live');
  });

  it('CB-2: a live edit card whose plan the server dropped (a dock PLAN, a render, a trash) is expired', () => {
    setPlan({ id: 'plan1', songId: 's1' } as Plan);
    propose(e('edit1', 'plan1'));
    dropPlan('s1');
    expect(proposalLife('edit1')).toBeNull();
    expect(liveEdit('t1')).toBeUndefined();
  });
});
