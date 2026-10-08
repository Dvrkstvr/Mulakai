/** A library row's look: `selected` (sky, the detail rail's song) and `playing` (the footer is
 * playing it right now) are independent, so a row can be both. */
export function songRowState(songId: string, detailSongId: string | null, playingId: string | undefined, isPlaying: boolean) {
  const live = playingId === songId && isPlaying;
  const className = ['row', songId === detailSongId && 'selected', live && 'playing'].filter(Boolean).join(' ');
  return { live, className };
}
