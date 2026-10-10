/** The dock's verb tabs and their keys (DESIGN.md "Action dock"; D-027, D-032): SCORE is
 * appended last, key C, only when the server says SCORE is not hidden for this song. Pure. */
import type { DockVerb } from './dockTarget';

export interface VerbSpec { id: DockVerb; label: string; key: string }

export const BASE_VERBS: readonly VerbSpec[] = [
  { id: 'repaint', label: 'REPAINT', key: 'R' },
  { id: 'addLayer', label: 'ADD LAYER', key: 'L' },
  { id: 'split', label: 'SPLIT', key: 'S' },
  { id: 'export', label: 'EXPORT', key: 'E' },
];

export const SCORE_VERB: VerbSpec = { id: 'score', label: 'SCORE', key: 'C' };

export function dockVerbs(scoreShown: boolean): readonly VerbSpec[] {
  return scoreShown ? [...BASE_VERBS, SCORE_VERB] : BASE_VERBS;
}

/** An action button's words: SPLIT names the layer it acts on (`SPLIT BASE`); the others are their verb. */
export function actionLabel(v: VerbSpec, layerName: string): string {
  return v.id === 'split' ? `SPLIT ${layerName.toUpperCase()}` : v.label;
}

/** The verb a bare key picks among those on show, or null. */
export function verbOfKey(verbs: readonly VerbSpec[], key: string): DockVerb | null {
  return verbs.find((v) => v.key.toLowerCase() === key.toLowerCase())?.id ?? null;
}
