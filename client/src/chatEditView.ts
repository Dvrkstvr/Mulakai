/** What the CHAT screen needs for edit cards beyond the card state (CB-5, chat-edit.html 1, 4c): the strip's bar count,
 * ASK AGAIN's text and the song's version numbers. Decides nothing the server owns. Pure. */
import type { SongDetail } from './api';
import type { ChatMessageView } from './api/chat';
import type { ChatEditBody } from './api/chatEdit';

/** The song as read, in bars (D-066): `checks.bars` is the edited score, so a CUT adds its span back and a REPEAT
 * takes its copy out. */
export function stripTotal(b: Pick<ChatEditBody, 'splice' | 'checks'>): number {
  const s = b.splice;
  if (!s.splice || s.kind === 'reharmonize') return b.checks.bars;
  const n = s.to_bar - s.from_bar + 1;
  return s.kind === 'cut' ? b.checks.bars + n : b.checks.bars - n;
}

/** ASK AGAIN on a stale or expired card: the person's message the card answered; null when there is none. */
export function askAgainText(messages: ChatMessageView[], cardId: string): string | null {
  const i = messages.findIndex((m) => m.id === cardId);
  const user = i > 0 ? messages.slice(0, i).findLast((m) => m.role === 'user') : undefined;
  return user?.text.trim() ? user.text : null;
}

/** The base layer's active version as vN and the number APPLY would save. The song detail lists versions newest first,
 * so vN = length - index (as the Editor's ActionDock numbers them). */
export function songVersions(song: Pick<SongDetail, 'layers'> | null): { active: number | null; activeId: string | null; next: number } {
  const versions = (song?.layers.find((l) => l.kind === 'base') ?? song?.layers[0])?.versions ?? [];
  const i = versions.findIndex((v) => v.active);
  return { active: i < 0 ? null : versions.length - i, activeId: versions[i]?.id ?? null, next: Math.max(versions.length, 1) + 1 };
}
