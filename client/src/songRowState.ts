/** A library row's look: `selected` (sky, the detail rail's song) and `playing` (the footer is
 * playing it right now) are independent, so a row can be both. */
export function songRowState(songId: string, detailSongId: string | null, playingId: string | undefined, isPlaying: boolean) {
  const live = playingId === songId && isPlaying;
  const className = ['row', songId === detailSongId && 'selected', live && 'playing'].filter(Boolean).join(' ');
  return { live, className };
}

/** A click on the row opens the detail rail unless it hit one of the row's own controls (play, EDIT, ♥, ✕, a badge's
 * button), which keep their actions. */
export function rowClickOpensDetail(target: { closest: (selector: string) => unknown } | null): boolean {
  return !!target && !target.closest('button, a, input, select, textarea');
}
