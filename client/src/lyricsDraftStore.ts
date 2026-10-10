/** The Editor's words draft, kept per song in this browser until a repaint keeps it (PLAN.md "Editor Redesign", PR 7):
 * leaving the Editor no longer loses an edit. A draft made against older lyrics (a repaint or a revert changed the
 * song's words since) is dropped. Storage can fail (private mode, blocked): then the draft just isn't kept. */

interface Stored { base: string; draft: string }

const key = (songId: string) => `mulakai.wordsDraft.${songId}`;

/** The draft to start from: the stored one if it was made against these lyrics, else the lyrics. Pure. */
export function restoreDraft(stored: Stored | null, songLyrics: string): string {
  return stored && stored.base === songLyrics ? stored.draft : songLyrics;
}

export function loadDraft(songId: string): Stored | null {
  try {
    const raw = localStorage.getItem(key(songId));
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

/** Keeps the draft while it differs from the song's lyrics; an unchanged draft clears the entry. */
export function saveDraft(songId: string, songLyrics: string, draft: string): void {
  try {
    if (draft === songLyrics) localStorage.removeItem(key(songId));
    else localStorage.setItem(key(songId), JSON.stringify({ base: songLyrics, draft }));
  } catch { /* not kept */ }
}
