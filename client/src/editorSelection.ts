import type { Region } from './Waveform';

/**
 * Point, then act (PLAN.md "Editor Redesign", PR 4): a picked range (drag, section, lyric line, a version's region)
 * is the target of whichever verb is open and stays on screen under every verb until its ✕; picking one never
 * switches the verb. Under SCORE a dragged range is kept for REPAINT, and SCORE's chip says it is ignored (M2-2).
 */
export function pickRange(region: Region | null, setSelection: (r: Region | null) => void) {
  setSelection(region);
}

/**
 * A lane's own selection events. A drag selects there, and on a lane that isn't focused it focuses that layer in the
 * same move. A plain click (the waveform reports it as a clear) never clears: the selection survives until its ✕, and
 * on another lane the click only focuses it (the lane's own click handler), the range moving with the focus.
 */
export function laneSelect(focused: boolean, region: Region | null, onFocus: () => void, onSelect: (r: Region | null) => void) {
  if (!region) return;
  if (!focused) onFocus();
  onSelect(region);
}
