/** LOOP SELECTION in the Editor's transport: where the playhead jumps so playback stays inside the selection. Pure. */
import type { Region } from './Waveform';

/** Playback crossed the selection's end (from `prev` to `t`): back to its start. A playhead already past the end
 * (the user seeked there) plays on, as in a DAW. Null = no jump. */
export function loopWrap(prev: number, t: number, region: Region | null): number | null {
  if (!region || region.end <= region.start) return null;
  return prev < region.end && t >= region.end ? region.start : null;
}

/** Turning the loop on while playing outside the selection starts it from the selection's start. */
export function loopEntry(t: number, region: Region | null): number | null {
  if (!region || region.end <= region.start) return null;
  return t < region.start || t >= region.end ? region.start : null;
}
