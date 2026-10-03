/** Whether the dock's fields still hold what a landed job was submitted with (PLAN.md "UI
 * Redesign", S4.7): commits stay live while jobs run, so anything set up after one was
 * committed is the user's next edit and must survive it landing. Pure. */
import type { AddLayerSubmission, RepaintSubmission } from './editorJob';

/** No selection is the whole layer, sent as 0 to -1 (repaintRequest). */
export function repaintFieldsUnchanged(
  submitted: RepaintSubmission | undefined, selection: { start: number; end: number } | null, prompt: string,
): boolean {
  if (!submitted) return false;
  return submitted.prompt === prompt
    && submitted.start === (selection?.start ?? 0)
    && submitted.end === (selection?.end ?? -1);
}

/** `lyrics` is what a submit would send now: the draft's lyrics trimmed, or '' for a track that isn't sung. */
export function addLayerFieldsUnchanged(
  submitted: AddLayerSubmission | undefined, prompt: string, trackName: string, lyrics: string,
): boolean {
  if (!submitted) return false;
  return submitted.prompt === prompt && submitted.trackName === trackName && submitted.lyrics === lyrics;
}
