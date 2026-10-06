/** What the CHAT screen shows for a thread (pipeline/design/chat-turn.html TU-6, TU-8, TU-10): a recipe card's
 * state with the take overlaid, the sidebar's mode and foot, the song's version. Decides nothing the server owns
 * (blockers, message states); it only combines them with the client's turn and take. Pure. */
import type { ChatDraftFields, ChatDraftKey, ChatMessageView, ChatSongBody, ChatThreadView } from './api/chat';
import type { CommitPhase, CommitState, TurnState } from './chatTurn';
import type { SongDetail } from './api';
import { SIDEBAR_FOOT } from './chatCopy';

export type CardView =
  | { kind: 'pending'; error: string | null }
  | { kind: 'committing'; phase: CommitPhase | null }
  | { kind: 'superseded' } | { kind: 'expired' } | { kind: 'done' };

/** The server's state, with this tab's take over it: a failed take puts the card back to pending with the error. */
export function cardView(m: ChatMessageView, commit: CommitState | null): CardView {
  if (commit && m.proposalId && commit.proposalId === m.proposalId) {
    return commit.phase.kind === 'failed' ? { kind: 'pending', error: commit.phase.error } : { kind: 'committing', phase: commit.phase };
  }
  switch (m.state) {
    case 'superseded': return { kind: 'superseded' };
    case 'expired': return { kind: 'expired' };
    case 'done': return { kind: 'done' };
    case 'committing': return { kind: 'committing', phase: null };
    default: return { kind: 'pending', error: null };
  }
}

/** A take is running from a card of this thread (the sidebar locks, TU-8; the composer says WAITING FOR v1). */
export const committing = (t: ChatThreadView | null, commit: CommitState | null): boolean =>
  !!t && t.messages.some((m) => m.kind === 'recipe' && cardView(m, commit).kind === 'committing');

export type SidebarMode = 'draft' | 'locked' | 'song';
export const sidebarMode = (t: ChatThreadView | null, commit: CommitState | null): SidebarMode =>
  t?.songId ? 'song' : committing(t, commit) ? 'locked' : 'draft';

/** The take's line offers CANCEL only while it waits behind another job (ChatRecipeCard): the foot says so then. */
export const takeCancellable = (phase: CommitPhase | null | undefined): boolean => phase?.kind === 'queued' && phase.ahead > 0;

export function sidebarFoot(t: ChatThreadView | null, commit: CommitState | null, assistantOn: boolean): string {
  const mode = sidebarMode(t, commit);
  if (mode === 'locked') return takeCancellable(commit?.phase) ? SIDEBAR_FOOT.lockedQueued : SIDEBAR_FOOT.locked;
  if (mode !== 'draft') return SIDEBAR_FOOT[mode];
  if (!assistantOn) return SIDEBAR_FOOT.off;
  const pending = t?.messages.some((m) => m.kind === 'recipe' && cardView(m, commit).kind === 'pending');
  return pending ? SIDEBAR_FOOT.card : SIDEBAR_FOOT.empty;
}

/** The newest song card's version: the player's pill and the title row (F-045). */
export function latestSong(t: ChatThreadView | null): ChatSongBody | null {
  const m = t?.messages.findLast((x) => x.kind === 'song' || x.kind === 'version');
  return (m?.body as ChatSongBody | null | undefined) ?? null;
}

export const fmtLength = (s: number | null | undefined): string | null =>
  s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : null;

const empty = (v: unknown) => v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** While the assistant thinks, the empty fields are what this turn can fill: dashed FILLING… (TU-4). */
export function fillingKeys(fields: ChatDraftFields | null, turn: TurnState): ChatDraftKey[] {
  if (!fields || turn.phase.kind !== 'thinking' || turn.cancelling) return [];
  return (Object.keys(fields) as ChatDraftKey[]).filter((k) => k !== 'engine' && empty(fields[k]));
}

/** The recipe's fields the person changed since the proposal: the card's YOUR EDIT and the struck tempo (TU-7). */
export function editedSinceProposal(recipe: Partial<Omit<ChatDraftFields, 'engine'>>, live: ChatDraftFields): ChatDraftKey[] {
  return (Object.keys(live) as ChatDraftKey[]).filter((k) => k !== 'engine' && k in recipe && JSON.stringify(recipe[k]) !== JSON.stringify(live[k]));
}

/** The take the player plays: the base layer's active version (as the Editor and the lyrics lane read it).
 * GET /api/songs/:id carries no `audio_file`; only the Library list does. */
export function playerTake(song: Pick<SongDetail, 'layers'> | null): string | null {
  const base = song?.layers.find((l) => l.kind === 'base') ?? song?.layers[0];
  return base?.versions.find((v) => v.active)?.audio_file ?? null;
}
