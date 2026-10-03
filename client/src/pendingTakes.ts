/** How many new takes of one layer are already on their way (PLAN.md "UI Redesign", S4.7), so a
 * consequence line names the version a commit will really save: "saves vocals v6" while v5 is
 * still queued. Pure. */
import type { QueueEntry, QueueRunning } from './api';
import type { SingleEditorJob } from './editorJob';

/** The kinds that append a version to the layer they work on. */
const TAKE_KINDS = new Set<string>(['repaint', 'regenerate', 'retake']);

interface LayerRef {
  id: string;
  name: string;
  songId: string;
}

/** Counts this tab's in-flight repaint / alt / similar takes on the layer, plus any the server's
 * queue lists for it (another tab's, matched by song and layer name), each job once. */
export function pendingTakes(
  layer: LayerRef, jobs: SingleEditorJob[], queue: { running: QueueRunning | null; queued: QueueEntry[] },
): number {
  const ids = new Set<string>();
  for (const job of jobs) {
    if (TAKE_KINDS.has(job.kind) && 'layerId' in job && job.layerId === layer.id && job.stage === 'running') {
      ids.add(job.jobId || job.key);
    }
  }
  const name = layer.name.toLowerCase();
  for (const entry of [...(queue.running ? [queue.running] : []), ...queue.queued]) {
    if (TAKE_KINDS.has(entry.kind) && entry.songId === layer.songId && entry.layer?.toLowerCase() === name) ids.add(entry.jobId);
  }
  return ids.size;
}
