import { describe, it, expect, beforeEach } from 'vitest';
import { RECIPE } from '../../../test-fakes/chatScripts.js';
import { analyzeById, dropProposals, liveAnalyze, liveProposal, proposalById, proposalLife, propose, resetProposals } from './proposalStore.js';

const p = (id: string, threadId = 't1') => ({ id, threadId, messageId: `m-${id}`, createdAt: 0, kind: 'recipe' as const, recipe: RECIPE });
const a = (id: string, threadId = 't1') => ({ id, threadId, messageId: `m-${id}`, createdAt: 0, kind: 'analyze' as const, target: { referenceId: 'r1' } });

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
});
