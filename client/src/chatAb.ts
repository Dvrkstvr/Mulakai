/** A/B (F-062, RF-6; C0b's CB-5 adds versions): which source plays and where a swap resumes. The other file starts at
 * the same seconds, clamped to its length; past its end it waits at the end, paused. The one clamp (chat-client
 * rule): the player and the song panel never compute it themselves. Pure. */
import type { ReferenceView } from './api/chatReferences';

export type AbSide = 'song' | 'reference';
/** The song's take and the reference's copy (`ReferenceView.url`); null = nothing to A/B against. */
export interface AbSources { song: string; reference: string | null }
/** What was playing when the side flipped. */
export interface AbCarry { at: number; play: boolean }

/** The side that really plays: the reference only when there is one. */
export const abSide = (s: AbSources, side: AbSide): AbSide => (side === 'reference' && s.reference ? 'reference' : 'song');
export const abSource = (s: AbSources, side: AbSide): string => (abSide(s, side) === 'reference' ? s.reference! : s.song);
export const abToggle = (side: AbSide): AbSide => (side === 'song' ? 'reference' : 'song');

/** The same seconds in a file of `duration`: never before 0, never past its end (`ended`). */
export function abPosition(at: number, duration: number): { at: number; ended: boolean } {
  const t = Number.isFinite(at) && at > 0 ? at : 0;
  return t >= duration ? { at: duration, ended: true } : { at: t, ended: false };
}

/** Once the new file knows its length: where to seek and whether to play on; null = not loaded yet. */
export function abResume(carry: AbCarry, duration: number): { seek: number; play: boolean } | null {
  if (!(duration > 0)) return null;
  const p = abPosition(carry.at, duration);
  return { seek: p.at, play: carry.play && !p.ended };
}

/** The thread's reference to A/B against: the newest with a file (the list is oldest first). */
export function abReference(refs: ReferenceView[] | undefined): ReferenceView | null {
  const withFile = (refs ?? []).filter((r) => r.url);
  return withFile[withFile.length - 1] ?? null;
}
