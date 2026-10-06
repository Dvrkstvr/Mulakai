/**
 * Live recipe proposals, in memory only (docs/decisions/0004, 0007): one live proposal per thread, a
 * newer one supersedes the older; a restart forgets them all, so their cards read EXPIRED. Edit
 * proposals (C0b) are planStore plans, referenced by planId.
 */
import type { Proposal } from './chatTypes.js';

export type RecipeProposal = Extract<Proposal, { kind: 'recipe' }>;
export type ProposalLife = 'live' | 'superseded';

const live = new Map<string, RecipeProposal>(); // threadId -> the live one
const known = new Map<string, RecipeProposal>(); // proposalId -> every one since start

/** Make `p` its thread's live proposal; the previous one is superseded. */
export function propose(p: RecipeProposal): void {
  live.set(p.threadId, p);
  known.set(p.id, p);
}

export const liveProposal = (threadId: string): RecipeProposal | undefined => live.get(threadId);

/** `live`, `superseded`, or null when this server never saw it (a restart): EXPIRED. */
export function proposalLife(id: string): ProposalLife | null {
  const p = known.get(id);
  if (!p) return null;
  return live.get(p.threadId)?.id === id ? 'live' : 'superseded';
}

export const proposalById = (id: string): RecipeProposal | undefined => known.get(id);

/** NEW CHAT dropped the thread: its proposals go with it. */
export function dropProposals(threadId: string): void {
  live.delete(threadId);
  for (const [id, p] of known) if (p.threadId === threadId) known.delete(id);
}

export function resetProposals(): void {
  live.clear();
  known.clear();
}
