import { describe, it, expect, beforeEach } from 'vitest';
import { RECIPE } from '../../../test-fakes/chatScripts.js';
import { dropProposals, liveProposal, proposalLife, propose, resetProposals } from './proposalStore.js';

const p = (id: string, threadId = 't1') => ({ id, threadId, messageId: `m-${id}`, createdAt: 0, kind: 'recipe' as const, recipe: RECIPE });

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
});
