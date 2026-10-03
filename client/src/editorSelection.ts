import type { Region } from './Waveform';
import type { DockVerb } from './dockTarget';

/**
 * A range is only ever REPAINT's target, so picking one (drag, section, lyric line, a version's
 * region) opens REPAINT; clearing it leaves the verb alone.
 */
export function pickRange(region: Region | null, setSelection: (r: Region | null) => void, setVerb: (v: DockVerb) => void) {
  setSelection(region);
  if (region) setVerb('repaint');
}

/** The range as painted: under any other verb the kept range isn't drawn, so it never reads
 * as that verb's target. */
export function shownRange(verb: DockVerb, selection: Region | null): Region | null {
  return verb === 'repaint' ? selection : null;
}
