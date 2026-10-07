/**
 * Live proposals, in memory only (docs/decisions/0004, 0007): one live proposal per thread and kind, a
 * newer one supersedes the older of its kind; a restart forgets them all, so their cards read EXPIRED.
 * Kinds: a recipe card (CREATE SONG / CREATE COVER), C3 an analyze card (READ) and C0b an edit card
 * (APPLY), which never supersede each other. An edit card holds only its plan's id: the plan lives in
 * planStore, and a card whose plan the server dropped (a dock PLAN, a render, a trash) reads EXPIRED.
 */
import { getPlanById } from '../score/planStore.js';
import type { Proposal } from './chatTypes.js';

export type RecipeProposal = Extract<Proposal, { kind: 'recipe' }>;
export type AnalyzeProposal = Extract<Proposal, { kind: 'analyze' }>;
export type EditProposal = Extract<Proposal, { kind: 'edit' }>;
type Stored = RecipeProposal | AnalyzeProposal | EditProposal;
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
const planAlive = (p: Stored | undefined) => p?.kind !== 'edit' || Boolean(getPlanById(p.planId));
export const liveEdit = (threadId: string): EditProposal | undefined => {
  const p = live.get(slot('edit', threadId)) as EditProposal | undefined;
  return planAlive(p) ? p : undefined;
};

/** `live`, `superseded`, or null when this server never saw it (a restart): EXPIRED. */
export function proposalLife(id: string): ProposalLife | null {
  const p = known.get(id);
  if (!p) return null;
  if (live.get(slot(p.kind, p.threadId))?.id !== id) return 'superseded';
  return planAlive(p) ? 'live' : null;
}

const ofKind = <K extends Stored['kind']>(id: string, kind: K) => {
  const p = known.get(id);
  return p?.kind === kind ? (p as Extract<Stored, { kind: K }>) : undefined;
};
/** A recipe proposal only: CREATE SONG never runs from a READ card's id. */
export const proposalById = (id: string): RecipeProposal | undefined => ofKind(id, 'recipe');
export const analyzeById = (id: string): AnalyzeProposal | undefined => ofKind(id, 'analyze');
export const editById = (id: string): EditProposal | undefined => ofKind(id, 'edit');

/** NEW CHAT dropped the thread: its proposals go with it. */
export function dropProposals(threadId: string): void {
  live.delete(slot('recipe', threadId));
  live.delete(slot('analyze', threadId));
  live.delete(slot('edit', threadId));
  for (const [id, p] of known) if (p.threadId === threadId) known.delete(id);
}

export function resetProposals(): void {
  live.clear();
  known.clear();
}
