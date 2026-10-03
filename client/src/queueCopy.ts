/** What Activity's UP NEXT rows and the commits' consequence lines say about the queue (PLAN.md
 * "UI Redesign", S4.7). Pure. */
import type { QueueEntry } from './api';
import type { ActivityKind } from './activitySettle';

/** What the job does when no label came with it (a generation has none). */
const VERB: Record<ActivityKind, string> = {
  generate: 'GENERATE', repaint: 'REPAINT', regenerate: 'ALT TAKE', retake: 'SIMILAR TAKE', addLayer: 'ADD LAYER',
  split: 'SPLIT', remaster: 'REMASTER', transcribe: 'TRANSCRIBE', lyrics: 'READ LYRICS', timings: 'WORD TIMINGS',
  analyze: 'ANALYZE AUDIO', sample: 'FEELING LUCKY',
};

/** "starts after 2 jobs": `ahead` counts the running job and every queued one before it, so a
 * job at position N waits for N. */
export function startsAfter(ahead: number): string {
  if (ahead <= 0) return 'starts now';
  return `starts after ${ahead} job${ahead === 1 ? '' : 's'}`;
}

/** What a commit's consequence line adds while the queue is busy: " · starts after 2 jobs", or
 * nothing when the job would start at once (DESIGN.md's copy rule). */
export function queueSuffix(ahead: number): string {
  return ahead > 0 ? ` · ${startsAfter(ahead)}` : '';
}

/** The row's action line: "REPAINT 1:32–2:07 · starts after 1 job". */
export function queuedLine(entry: Pick<QueueEntry, 'kind' | 'label' | 'position'>): string {
  return `${(entry.label ?? VERB[entry.kind]).toUpperCase()} · ${startsAfter(entry.position)}`;
}

/** The row's title: the song (or what the job reads), then the layer an edit works on. */
export function queuedTitle(entry: Pick<QueueEntry, 'title' | 'layer'>, songTitle?: string): string {
  const name = entry.title ?? songTitle ?? 'Untitled';
  return entry.layer ? `${name} · ${entry.layer.toLowerCase()}` : name;
}
