/**
 * Live proposals, in memory only (docs/decisions/0004, 0007): one live proposal per thread and kind, a
 * newer one supersedes the older of its kind; a restart forgets them all, so their cards read EXPIRED.
 * Kinds: a recipe card (CREATE SONG / CREATE COVER) and, C3, an analyze card (READ), which never
 * supersede each other. Edit proposals (C0b) are planStore plans, referenced by planId.
 */
import type { Proposal } from './chatTypes.js';

export type RecipeProposal = Extract<Proposal, { kind: 'recipe' }>;
export type AnalyzeProposal = Extract<Proposal, { kind: 'analyze' }>;
type Stored = RecipeProposal | AnalyzeProposal;
export type ProposalLife = 'live' | 'superseded';

const live = new Map<string, Stored>(); // `${kind}:${threadId}` -> the live one
const known = new Map<string, Stored>(); // proposalId -> every one since start
const slot = (kind: Stored['kind'], threadId: string) => `${kind}:${threadId}`;

/** Make `p` its thread's live proposal of its kind; the previous one of that kind is superseded. */
export function propose(p: Stored): void {
  live.set(slot(p.kind, p.threadId), p);
  known.set(p.id, p);
}

export const liveProposal = (threadId: string): RecipeProposal | undefined => live.get(slot('recipe', threadId)) as RecipeProposal | undefined;
export const liveAnalyze = (threadId: string): AnalyzeProposal | undefined => live.get(slot('analyze', threadId)) as AnalyzeProposal | undefined;

/** `live`, `superseded`, or null when this server never saw it (a restart): EXPIRED. */
export function proposalLife(id: string): ProposalLife | null {
  const p = known.get(id);
  if (!p) return null;
  return live.get(slot(p.kind, p.threadId))?.id === id ? 'live' : 'superseded';
}

const ofKind = <K extends Stored['kind']>(id: string, kind: K) => {
  const p = known.get(id);
  return p?.kind === kind ? (p as Extract<Stored, { kind: K }>) : undefined;
};
/** A recipe proposal only: CREATE SONG never runs from a READ card's id. */
export const proposalById = (id: string): RecipeProposal | undefined => ofKind(id, 'recipe');
export const analyzeById = (id: string): AnalyzeProposal | undefined => ofKind(id, 'analyze');

/** NEW CHAT dropped the thread: its proposals go with it. */
export function dropProposals(threadId: string): void {
  live.delete(slot('recipe', threadId));
  live.delete(slot('analyze', threadId));
  for (const [id, p] of known) if (p.threadId === threadId) known.delete(id);
}

export function resetProposals(): void {
  live.clear();
  known.clear();
}
