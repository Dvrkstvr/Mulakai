import type { Region } from './Waveform';
import type { DockVerb } from './dockTarget';

/**
 * A range is only ever REPAINT's target, so picking one (drag, section, lyric line, a version's
 * region) opens REPAINT; clearing it leaves the verb alone. Under SCORE a dragged range stays on
 * SCORE (M2-2): REPAINT keeps it, SCORE's chip says it is ignored.
 */
export function pickRange(region: Region | null, setSelection: (r: Region | null) => void, setVerb: (v: DockVerb) => void, verb?: DockVerb) {
  setSelection(region);
  if (region && verb !== 'score') setVerb('repaint');
}

/** The range as painted: under any other verb the kept range isn't drawn, so it never reads
 * as that verb's target. */
export function shownRange(verb: DockVerb, selection: Region | null): Region | null {
  return verb === 'repaint' ? selection : null;
}
