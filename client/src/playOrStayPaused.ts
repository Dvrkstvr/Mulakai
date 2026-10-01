// Rejections that just mean "not playing yet": the autoplay policy blocked a play() with no
// user gesture behind it (e.g. a generation finishing after a reload), or a pause()/new src
// landed before playback began. Either way the element stays loaded and paused, PLAY ready.
const STAYS_PAUSED = new Set(['NotAllowedError', 'AbortError']);

/**
 * `play()` whose rejection is handled — a bare `void a.play()` surfaces it as an unhandled
 * rejection. `who` names the player in the log line for a real failure.
 */
export function playOrStayPaused(a: { play(): void | Promise<void> }, who: string): void {
  const started = a.play();
  if (!started) return;
  started.catch((err: unknown) => {
    const name = (err as { name?: unknown } | null)?.name;
    if (typeof name !== 'string' || !STAYS_PAUSED.has(name)) console.error(`${who}: play() failed`, err);
  });
}
