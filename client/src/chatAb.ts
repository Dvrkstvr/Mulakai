/** A/B (F-062, RF-6; C0b's CB-5: versions, F-048): which source plays and where a swap resumes. The other file starts
 * at the same seconds, clamped to its length; past its end it waits at the end, paused. The one clamp (chat-client
 * rule): the player and the song panel never compute it themselves. Pure. */
import type { SongDetail } from './api';
import type { ChatMessageView } from './api/chat';
import type { ChatVersionBody } from './api/chatEdit';
import type { ReferenceView } from './api/chatReferences';

/** `previous`: the version before the newest chat edit (BACK TO v1), not active until USE. */
export type AbSide = 'song' | 'reference' | 'previous';
/** The song's take, the reference's copy (`ReferenceView.url`) and the previous version's file; null = none. */
export interface AbSources { song: string; reference: string | null; previous?: string | null }
/** What was playing when the side flipped. */
export interface AbCarry { at: number; play: boolean }

/** The side that really plays: another side only when it has a file. */
export const abSide = (s: AbSources, side: AbSide): AbSide => (side !== 'song' && s[side] ? side : 'song');
export const abSource = (s: AbSources, side: AbSide): string => {
  const k = abSide(s, side);
  return k === 'song' ? s.song : s[k]!;
};
export const abToggle = (side: AbSide, other: Exclude<AbSide, 'song'> = 'reference'): AbSide => (side === 'song' ? other : 'song');

/** BACK TO vN (F-048 #2): the newest version card A/Bs against the version before it while it is the active take and
 * that version still has its file (deleted in the Editor → none, F-048 edge). */
export function abPrevious(card: ChatMessageView | null, song: Pick<SongDetail, 'layers'> | null):
  { versionId: string; number: number; current: number; url: string } | null {
  const body = card?.body as ChatVersionBody | null | undefined;
  const versions = (song?.layers.find((l) => l.kind === 'base') ?? song?.layers[0])?.versions ?? [];
  if (!card || !body?.previous || !versions.find((v) => v.id === card.versionId)?.active) return null;
  const prev = versions.find((v) => v.id === body.previous!.versionId);
  return prev?.audio_file ? { versionId: prev.id, number: body.previous.number, current: body.number, url: `/audio/${prev.audio_file}` } : null;
}

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
