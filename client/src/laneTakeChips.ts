/** Takes on the lane (PLAN.md "Editor Redesign", PR 8): a lane header's take chips and what an in-place listen
 * (A/B) plays. Pure. */
import type { Layer } from './api';
import type { SingleEditorJob } from './editorJob';

export type TakeChip =
  | { kind: 'take'; versionId: string; number: number; active: boolean }
  | { kind: 'running'; key: string; number: number; queued: boolean; label: string }
  | { kind: 'more'; count: number };

/** Jobs that end as a new take of an existing layer. */
const TAKE_JOBS = new Set<SingleEditorJob['kind']>(['repaint', 'regenerate', 'retake']);
const RUNNING_LABEL: Record<string, string> = { repaint: 'repainting', regenerate: 'rerolling', retake: 'making one more like it' };

/** v1 … vN oldest first, the newest `max` (the active one always kept), a `more` chip for the rest, then one dashed
 * chip per take still being made on this layer. */
export function laneTakes(layer: Layer, jobs: SingleEditorJob[], max = 6): TakeChip[] {
  const n = layer.versions.length;
  const all = layer.versions.map((v, i) => ({ kind: 'take' as const, versionId: v.id, number: n - i, active: !!v.active })).reverse();
  const shown = all.filter((t, i) => i >= n - max || t.active);
  const chips: TakeChip[] = shown.length < n ? [{ kind: 'more', count: n - shown.length }, ...shown] : shown;
  const running = jobs.filter((j) => TAKE_JOBS.has(j.kind) && 'layerId' in j && j.layerId === layer.id && j.stage === 'running');
  running.forEach((j, i) => chips.push({
    kind: 'running', key: j.key, number: n + i + 1, queued: !!j.queuePosition, label: RUNNING_LABEL[j.kind] ?? 'making',
  }));
  return chips;
}

export interface Audition { layerId: string; versionId: string }

/** The layers as the mix should play them: an auditioned take sounds in its layer's place, nothing is saved. */
export function auditionLayers(layers: Layer[], audition: Audition | null): Layer[] {
  if (!audition) return layers;
  return layers.map((l) => (l.id !== audition.layerId || !l.versions.some((v) => v.id === audition.versionId) ? l : {
    ...l, versions: l.versions.map((v) => ({ ...v, active: (v.id === audition.versionId ? 1 : 0) as 0 | 1 })),
  }));
}
